import { readProduct } from './listing.js';
// HTTP handlers (Web Request -> Response). api/*.js wire these to Vercel routes.

import crypto from 'node:crypto';
import { TAGS } from './config.js';
import { cancelDispatch, dispatchOrder } from './dispatch.js';
import { defaultDeliveryMode, isExpressOrder, normalizePhone } from './mapping.js';
import { connectWebhooks, createManualOrder, createTestOrder, getConnection } from './setup.js';
import { verifyWebhookHmac } from './shopify.js';
import { applyTaskStatus, handleStatusUpdate, STATUS_LABELS, syncActiveOrders, toDegrees } from './status.js';
import { buildLive } from './live.js';
import { areaList, checkoutRates, expressStatus, locate, matchArea, nextOpening, parseHolidays, promise, quickTier, schedule, whenText } from './express.js';
import { disableTest, dropFixedTestRate, enableTest, testStatus } from './express-test.js';
import { renameRate } from './express-admin.js';
import { checkoutStatus, disableCheckoutRates, disableFixedRates, enableCheckoutRates, enableFixedRates, liveSettings, setSetting } from './express-admin.js';
import * as geo from './geo.js';
import { findMentions, productEvidence, removeMentions } from './cleanup.js';
import { customerCounts, exportedOrders, exportStatus, startExport } from './insights.js';
import { clubSettings, simulate } from './club.js';
import { createPromotion, listAutomaticDiscounts, PROMOTIONS } from './promos.js';
import { shopifyAdminUrl, VIEWS } from './orders.js';
import { trackingUrl, verifyTrackingToken } from './tracking.js';
import { renderCleanup, renderClub, renderDashboard, renderEvidence, renderExpress, renderNewOrder, renderOrderDetail, renderPromos, renderTrackingPage } from './views.js';

const json = (body, status = 200) => Response.json(body, { status });

const isStaging = (cfg) => cfg.noon.baseUrl.includes('noonstg');

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

function tagList(tags) {
  return Array.isArray(tags) ? tags : String(tags || '').split(',').map((t) => t.trim()).filter(Boolean);
}

// ---- Shopify webhooks: orders/create, orders/updated, orders/cancelled ----

export async function handleShopifyWebhook(request, d) {
  const raw = await request.text();
  if (!verifyWebhookHmac(raw, request.headers.get('x-shopify-hmac-sha256'), d.cfg.shopify.webhookSecret)) {
    return json({ error: 'invalid signature' }, 401);
  }
  const topic = request.headers.get('x-shopify-topic');
  const payload = JSON.parse(raw);
  const tags = tagList(payload.tags);

  switch (topic) {
    case 'orders/create': {
      // REST payload -> the fields isExpressOrder reads.
      const line = payload.shipping_lines?.[0];
      const lineItems = { nodes: (payload.line_items || []).map((li) => ({
        sellingPlan: li.selling_plan_allocation || (li.properties || []).some((p) => p.name === '_plx_sub') ? {} : null,
      })) };
      const order = { shippingLine: line && { title: line.title, code: line.code }, lineItems };
      if (!isExpressOrder(order, d.cfg)) {
        return json({ skipped: 'not an express order' });
      }
      await d.shopify.addTags(payload.id, [TAGS.express]);
      // Paid after the cutoff (checkout opened at 4:55, paid at 5:05) or on a day off: it goes
      // in the next run, whatever the rate's name said.
      const live = await liveSettings(d);
      if (payload.created_at && schedule(new Date(payload.created_at), live).when !== 'today') {
        await d.shopify.addTags(payload.id, [TAGS.nextRun]);
      }
      // Checkout can't check distance on fixed rates: an Express order beyond the limit goes
      // as noon 4-hour delivery instead, flagged for the team.
      const a = payload.shipping_address;
      const g = d.geo || geo;
      // Shopify's own pin for the address, else look the address up.
      let pin = a?.latitude != null && a?.longitude != null ? { lat: Number(a.latitude), lng: Number(a.longitude) } : null;
      if (!pin && a && g.geocode) pin = await g.geocode([a.address1, a.address2, a.city, a.province || 'Dubai'].filter(Boolean).join(', ')).catch(() => null);
      if (defaultDeliveryMode(order, d.cfg) === 'standard' && pin) {
        const km = await g.drivingKm(d.cfg.express.warehouse, pin);
        if (km != null && km > d.cfg.express.expressMaxKm) {
          // 4-hour is off for now: flag it for the team instead of switching the service.
          if (d.cfg.express.fourHour) await d.shopify.setNoonState(payload.id, { mode: '4hr_delivery' });
          await d.shopify.addTags(payload.id, [TAGS.outOfRange]);
        }
      }
      if (d.cfg.autoDispatch) return json(await dispatchOrder(d, payload.id));
      return json({ tagged: TAGS.express });
    }
    case 'orders/updated':
      // Staff added the noon-dispatch tag: book a rider.
      if (tags.includes(TAGS.dispatch) && !tags.includes(TAGS.dispatched) && !payload.cancelled_at) {
        return json(await dispatchOrder(d, payload.id));
      }
      return json({ skipped: 'nothing to do' });
    case 'orders/cancelled':
      if (tags.includes(TAGS.dispatched)) return json(await cancelDispatch(d, payload.id));
      return json({ skipped: 'no active rider' });
    default:
      return json({ skipped: `unhandled topic ${topic}` });
  }
}

// ---- noon webhooks ----

// The X-API-Key is required on production. noon's staging system can't send headers, so on
// staging a request without one is accepted (a wrong key is still rejected). Status updates
// are verified against noon's API in both cases; see handleStatusUpdate.
function noonAuthorized(request, d) {
  const key = request.headers.get('x-api-key');
  if (key === null && isStaging(d.cfg)) return true;
  return safeEqual(key, d.cfg.noon.webhookKey);
}

export async function handleNoonStatus(request, d) {
  if (!noonAuthorized(request, d)) return json({ error: 'unauthorized' }, 401);
  const update = await request.json().catch(() => null);
  return json(await handleStatusUpdate(d, update));
}

export async function handleNoonLocation(request, d) {
  if (!noonAuthorized(request, d)) return json({ error: 'unauthorized' }, 401);
  // The tracking page reads the live rider position from Get Task Details, so nothing is stored here.
  return json({ ok: true });
}

// ---- Staff dashboard (HTTP basic auth, any username + DASHBOARD_PASSWORD) ----

function dashboardAuthorized(request, d) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  return safeEqual(decoded.slice(decoded.indexOf(':') + 1), d.cfg.dashboardPassword);
}

const unauthorized = () =>
  new Response('Login required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Plaay noon dispatch"' } });

export async function handleDashboard(request, d) {
  if (!d.cfg.dashboardPassword) return new Response('DASHBOARD_PASSWORD is not set', { status: 503 });
  if (!dashboardAuthorized(request, d)) return unauthorized();

  const url = new URL(request.url);
  let flash = url.searchParams.get('msg') || '';

  if (request.method === 'POST') {
    // Browsers resend basic-auth credentials cross-site, so only accept same-origin form posts.
    const origin = request.headers.get('origin');
    if (!origin || origin !== url.origin) return new Response('Forbidden', { status: 403 });
    const form = await request.formData();
    const orderId = String(form.get('order') || '');
    const action = String(form.get('action') || '');
    if (!['connect', 'test-order', 'create-order', 'create-promotion'].includes(action) && !action.startsWith('express-') && action !== 'cleanup-remove' && !/^\d+$/.test(orderId)) return new Response('Bad order id', { status: 400 });

    let result;
    try {
      if (action === 'connect') {
        const results = await connectWebhooks(d.shopify, d.cfg);
        const failed = results.filter((r) => !r.ok);
        result = failed.length
          ? { ok: false, reason: failed.map((r) => `${r.topic}: ${r.error}`).join('; ') }
          : { ok: true, message: results.length ? 'Shopify connected' : 'Shopify was already connected' };
      } else if (action === 'test-order') {
        if (!isStaging(d.cfg)) return new Response('Test orders are only allowed while noon is on staging', { status: 403 });
        const order = await createTestOrder(d.shopify);
        result = { ok: true, message: `Test order ${order.name} created. It appears below once Shopify's order webhook arrives (a few seconds); refresh if needed.` };
      } else if (action === 'create-promotion') {
        const results = await createPromotion(d.shopify, String(form.get('promotion') || ''));
        form.set('back', '/promos');
        result = { ok: true, message: results.map((r) => `${r.title}: ${r.removed ? 'removed' : r.created ? `created (${r.count} products)` : r.skipped}`).join(' · ') };
      } else if (action === 'cleanup-remove') {
        const terms = String(form.get('terms') || '').split(',').map((t) => t.trim().replace(/[^\p{L}\p{N} ]/gu, '')).filter(Boolean).slice(0, 5);
        if (!terms.length) return new Response('No terms', { status: 400 });
        const r = await removeMentions(d.shopify, terms);
        form.set('back', `/cleanup?terms=${encodeURIComponent(terms.join(','))}`);
        result = { ok: true, message: [r.done.join('; ') || 'Nothing to delete.', r.left.length ? `Still to edit by hand: ${r.left.join('; ')}` : ''].filter(Boolean).join(' ') };
      } else if (action.startsWith('express-')) {
        if (!form.get('back')) form.set('back', '/express');
        result = (await expressAction(d, action, form)) || { ok: false, reason: 'unknown action' };
      } else if (action === 'create-order') {
        const f = {
          name: String(form.get('name') || '').trim().slice(0, 100),
          phone: normalizePhone(form.get('phone')),
          address1: String(form.get('address1') || '').trim().slice(0, 200),
          area: String(form.get('area') || '').trim().slice(0, 100),
          city: String(form.get('city') || 'Dubai').trim().slice(0, 60),
          item: String(form.get('item') || '').trim().slice(0, 200),
          amount: Math.max(0, Number(form.get('amount') || 0)) || 0,
          note: String(form.get('note') || '').trim().slice(0, 250),
          mode: form.get('mode') === '4hr_delivery' ? '4hr_delivery' : 'standard',
          test: form.get('test') === 'on',
        };
        const missing = [!f.name && 'name', !f.phone && 'a valid UAE phone number', f.address1.length < 5 && 'address', !(f.amount > 0) && 'an order value above AED 0 (noon requires one)'].filter(Boolean);
        if (missing.length) {
          result = { ok: false, reason: `Please enter ${missing.join(', ')}.` };
        } else {
          const order = await createManualOrder(d.shopify, f);
          form.set('back', `/order/${order.legacyResourceId}`);
          result = { ok: true, message: `Order ${order.name} created. Check the map pin, then dispatch when it's packed.` };
        }
      } else if (action === 'dispatch') result = await dispatchOrder(d, orderId, { mode: String(form.get('mode') || '') || undefined });
      else if (action === 'cancel') result = await cancelDispatch(d, orderId);
      else if (action === 'hide') {
        // Off the dashboard (tests, mistakes): the Express tags go, noon-hidden is added. The
        // Shopify order itself is not cancelled or refunded.
        await d.shopify.removeTags(orderId, [TAGS.express, TAGS.dispatch, TAGS.error, TAGS.outOfRange, TAGS.nextRun]);
        await d.shopify.addTags(orderId, ['noon-hidden']);
        form.set('back', '/');
        result = { ok: true, message: 'Removed from the dashboard (the Shopify order is unchanged).' };
      }
      else return new Response('Unknown action', { status: 400 });
      flash = result.message || (result.ok ? `${action === 'dispatch' ? 'Rider booked' : 'Rider cancelled'}${result.taskNr ? ` (${result.taskNr})` : ''}` : `Failed: ${result.reason}`);
    } catch (err) {
      d.log.error?.(err);
      flash = `Failed: ${err.message}`;
    }
    // Only same-site paths, so the redirect can't be pointed elsewhere.
    const backPath = String(form.get('back') || '/');
    const back = new URL(/^\/(?!\/)/.test(backPath) ? backPath : '/', url.origin);
    back.searchParams.set('msg', flash);
    return Response.redirect(back.toString(), 303);
  }

  const html = (body) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

  if (url.searchParams.has('new')) return html(renderNewOrder({ cfg: d.cfg, flash }));
  if (url.searchParams.has('club')) {
    const data = await exportedOrders(d.shopify);
    const s = clubSettings();
    return html(renderClub({ cfg: d.cfg, settings: s, sim: data ? simulate(data.orders, new Date(), s) : null, exportedAt: data?.exportedAt }));
  }
  if (url.searchParams.has('insights')) {
    const step = url.searchParams.get('insights');
    const body = step === 'start' || step === 'geo' ? await startExport(d.shopify, step === 'geo' ? 'geo' : 'orders') : step === 'customers' ? await customerCounts(d.shopify) : await exportStatus(d.shopify);
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (url.searchParams.has('evidence')) {
    const id = String(url.searchParams.get('evidence'));
    if (!/^gid:\/\/shopify\/Product\/\d+$/.test(id)) return new Response('Bad product id', { status: 400 });
    const since = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('since') || '') ? url.searchParams.get('since') : null;
    const ev = await productEvidence(d.shopify, id, { since });
    if (url.searchParams.get('format') === 'json') return Response.json(ev, { headers: { 'Cache-Control': 'no-store' } });
    return html(renderEvidence({ cfg: d.cfg, ev }));
  }
  if (url.searchParams.has('cleanup')) {
    const terms = String(url.searchParams.get('terms') || 'biscoff,lotus').split(',').map((t) => t.trim().replace(/[^\p{L}\p{N} ]/gu, '')).filter(Boolean).slice(0, 5);
    const result = await findMentions(d.shopify, terms);
    if (url.searchParams.get('format') === 'json') return Response.json({ terms, ...result }, { headers: { 'Cache-Control': 'no-store' } });
    return html(renderCleanup({ cfg: d.cfg, flash, terms, ...result }));
  }
  if (url.searchParams.has('express')) return html(renderExpress({ cfg: d.cfg, flash, ...(await expressPageData(d)) }));
  if (url.searchParams.has('promos')) {
    let discounts = [];
    let error = '';
    try {
      discounts = await listAutomaticDiscounts(d.shopify);
    } catch (err) {
      error = err.message;
    }
    return html(renderPromos({ cfg: d.cfg, flash, discounts, error, promotions: PROMOTIONS }));
  }

  const orderParam = url.searchParams.get('order');
  if (orderParam) {
    if (!/^\d+$/.test(orderParam)) return new Response('Bad order id', { status: 400 });
    const order = await d.shopify.getOrder(orderParam);
    if (!order) return new Response('Order not found', { status: 404 });
    let task = null;
    let taskError = '';
    if (order.noon.taskNr) {
      try {
        task = await d.noon.getTask(order.noon.taskNr);
      } catch (err) {
        taskError = err.message;
      }
      // Catch up on any status the webhooks missed.
      if (task?.status_code && task.status_code !== order.noon.status) {
        await applyTaskStatus(d, order, order.noon.taskNr, task.status_code).catch((err) => d.log.warn?.(`sync ${order.name}: ${err.message}`));
      }
    }
    const live = buildLive(order, task);
    // The order page polls this to keep its map and timers current.
    if (url.searchParams.get('live') === '1') return json({ ...live, taskError });
    const links = { shopify: shopifyAdminUrl(d.cfg, order.legacyResourceId), tracking: trackingUrl(d.cfg, order.legacyResourceId) };
    return html(renderOrderDetail({ order, task, taskError, cfg: d.cfg, flash, labels: STATUS_LABELS, links, live }));
  }

  // Read-only: how a product is set up (for copying its pattern to a new listing).
  if (url.searchParams.get('product')) {
    return json(await readProduct(d.shopify, url.searchParams.get('product').slice(0, 120)));
  }
  const view = VIEWS.some((v) => v.key === url.searchParams.get('view')) ? url.searchParams.get('view') : 'todo';
  const q = (url.searchParams.get('q') || '').slice(0, 100);
  const connection = await getConnection(d.shopify, d.cfg);
  let orders = [];
  if (connection.ok) {
    try {
      orders = await d.shopify.listOrdersByTag(TAGS.express, 100);
      await syncActiveOrders(d, orders); // updates the orders in place
    } catch (err) {
      connection.ordersError = err.message;
    }
  }
  const express = connection.ok ? expressStatus(await liveSettings(d)) : null;
  return html(renderDashboard({ orders, cfg: d.cfg, flash, labels: STATUS_LABELS, connection, view, q, express }));
}

// ---- Customer tracking ----

export async function handleTrackPage(request, d) {
  const token = new URL(request.url).searchParams.get('t');
  if (!verifyTrackingToken(d.cfg.trackingSecret, token)) return new Response('Tracking link not found', { status: 404 });
  return new Response(renderTrackingPage({ token }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function handleTrackData(request, d) {
  const orderId = verifyTrackingToken(d.cfg.trackingSecret, new URL(request.url).searchParams.get('t'));
  if (!orderId) return json({ error: 'not found' }, 404);

  const order = await d.shopify.getOrder(orderId);
  if (!order) return json({ error: 'not found' }, 404);

  const drop = order.shippingAddress && {
    lat: toDegrees(order.shippingAddress.latitude),
    lng: toDegrees(order.shippingAddress.longitude),
  };
  const items = (order.lineItems?.nodes || []).map((li) => ({ title: li.title, quantity: li.quantity }));
  const mode = order.noon.mode || defaultDeliveryMode(order, d.cfg);
  const body = { order: order.name, status: order.noon.status || 'not_dispatched', rider: null, drop, items, mode };

  if (order.noon.taskNr) {
    const task = await d.noon.getTask(order.noon.taskNr).catch(() => null);
    if (task) {
      body.status = task.status_code || body.status;
      const da = task.da_details;
      if (da) {
        body.rider = {
          // First name only on the customer page.
          name: (da.first_name || String(da.name || '').split(' ')[0] || 'Your rider').trim(),
          lat: toDegrees(da.location?.latitude),
          lng: toDegrees(da.location?.longitude),
          // Only share the rider's number while they are on the way to the customer.
          phone: ['picked_up', 'arrived_at_delivery'].includes(body.status) ? da.phone_number || null : null,
        };
      }
    }
  }
  body.label = STATUS_LABELS[body.status] || 'Preparing your order';
  return json(body);
}

// ---- Website delivery check (product page, bag, "Where should we deliver?" sheet) ----
// Public and read-only:
//   ?areas=1                 Dubai areas with their speed
//   ?q=<text>                address suggestions (areas first, then streets and buildings)
//   ?area=<id> | ?lat=&lng= | ?address=<text>   the delivery promise for that place right now;
//                            with a pin, also the address found there (for checkout)

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function handleExpressCheck(request, d) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const q = new URL(request.url).searchParams;
  const s = await liveSettings(d);
  const g = d.geo || geo;
  const out = (body, cache = 'no-store') => Response.json(body, { headers: { ...CORS, 'Cache-Control': cache } });

  if (q.get('areas')) {
    return out({ areas: areaList(s).map(({ id, name, tier, edge, lat, lng }) => ({ id, name, tier, edge, lat, lng })), paused: s.paused }, 'public, s-maxage=300, max-age=300');
  }
  if (q.get('q') != null) {
    const text = q.get('q').trim().toLowerCase();
    const areas = text.length < 2 ? [] : areaList(s).filter((a) => a.name.toLowerCase().includes(text)).slice(0, 4)
      .map(({ id, name, tier, edge, lat, lng }) => ({ kind: 'area', id, name, tier, edge, lat, lng }));
    const places = (await g.searchAddress(q.get('q'))).map((a) => ({ kind: 'address', ...a, area: matchArea(`${a.label} ${a.community}`, s)?.name || a.community, tier: quickTier(a, s) }));
    return out({ results: [...areas, ...places].slice(0, 8) }, 'public, s-maxage=600, max-age=600');
  }
  const lat = q.get('lat');
  const lng = q.get('lng');
  const place = await locate({ area: q.get('area'), lat: lat ?? undefined, lng: lng ?? undefined, address: q.get('address') }, s, g);
  const body = promise(place, new Date(), s);
  if (lat && lng && place && q.get('reverse')) body.address = await g.reverseAddress(lat, lng);
  return out(body);
}

// ---- Shopify carrier-calculated shipping (checkout rates) ----
// Express and 4-hour only; standard stays the store's own rate. Signed with the app secret.

// Ids of the hidden test products (tag express-test), cached for 5 minutes. Empty if unknown.
let previewCache = null;
async function previewProducts(d) {
  if (previewCache && Date.now() - previewCache.at < 300_000) return previewCache.ids;
  try {
    const t = await testStatus(d.shopify);
    previewCache = { at: Date.now(), ids: t.products.map((p) => p.id.split('/').pop()) };
  } catch {
    previewCache = { at: Date.now(), ids: previewCache?.ids || [] };
  }
  return previewCache.ids;
}

export async function handleCheckoutRates(request, d) {
  const raw = await request.text();
  if (!verifyWebhookHmac(raw, request.headers.get('x-shopify-hmac-sha256'), d.cfg.shopify.webhookSecret)) {
    return json({ error: 'invalid signature' }, 401);
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }
  const s = { ...(await liveSettings(d)), previewProducts: await previewProducts(d) };
  const rates = await checkoutRates(body.rate, new Date(), s, d.geo || geo);
  const dest = body.rate?.destination || {};
  // No names, streets or phone numbers in the log: area-level only.
  d.log?.info?.(`rates totals=${JSON.stringify(body.rate?.order_totals || null)} ${s.checkout} ${dest.country}/${dest.province}/${dest.city} items=${(body.rate?.items || []).length} props=${[...new Set((body.rate?.items || []).flatMap((i) => Object.keys(i.properties || {})))].join('|')} -> ${rates.map((r) => r.service_code).join(',') || 'none'}`);
  return json({ rates });
}

// ---- Dashboard: Express settings page actions ----

export async function expressAction(d, action, form) {
  if (action === 'express-pause') {
    // mode: resume | 1h | today (until the next opening) | manual (until resumed). Old form: paused=true|false.
    const mode = String(form.get('mode') || (form.get('paused') === 'true' ? 'manual' : form.get('paused') === 'false' ? 'resume' : ''));
    const s = await liveSettings(d);
    if (mode === 'resume') {
      await setSetting(d.shopify, 'paused', false);
      await setSetting(d.shopify, 'paused_until', '1970-01-01T00:00:00Z'); // Shopify won't store an empty value
      return { ok: true, message: 'Express is on again (website and checkout within a minute).' };
    }
    if (mode === 'manual') {
      await setSetting(d.shopify, 'paused', true);
      return { ok: true, message: 'Express paused until someone turns it back on. Shoppers see standard delivery only.' };
    }
    const until = mode === '1h' ? new Date(Date.now() + 3600e3) : mode === 'today' ? nextOpening(new Date(), s) : null;
    if (!until) return { ok: false, reason: 'Unknown pause option.' };
    await setSetting(d.shopify, 'paused', false);
    await setSetting(d.shopify, 'paused_until', until.toISOString());
    return { ok: true, message: `Express paused until ${whenText(until)}, then it comes back on by itself.` };
  }
  if (action === 'express-checkout') {
    const mode = String(form.get('mode'));
    if (!['off', 'preview', 'on'].includes(mode)) return { ok: false, reason: 'unknown mode' };
    await setSetting(d.shopify, 'checkout', mode);
    return { ok: true, message: { off: 'Checkout shows standard delivery only.', preview: 'Checkout offers Express only to bags holding the hidden test product.', on: 'Checkout offers Express to everyone in range.' }[mode] };
  }
  if (action === 'express-carrier-on') {
    const r = await enableCheckoutRates(d.shopify, d.cfg);
    // Checkout now measures each address: the test product's fixed Express rate is no longer needed,
    // and Express stays limited to bags from pages with the Express box (preview) until launch.
    const dropped = await dropFixedTestRate(d.shopify);
    const s = await liveSettings(d);
    if (s.checkout === 'off') await setSetting(d.shopify, 'checkout', 'preview');
    return { ok: true, message: `Checkout delivery rates connected${r.added.length ? ` and added to ${r.added.join(', ')}` : ''}. Express now shows only for addresses within ${d.cfg.express.expressMaxKm} km${dropped.removed ? '; the fixed test rate was removed' : ''}.` };
  }
  if (action === 'express-fixed-on') {
    const r = await enableFixedRates(d.shopify);
    return { ok: true, message: r.created ? `Dubai now has its own delivery zone with Express and 4-hour (free on AED 99+), plus the ${r.standard} normal rate(s) copied from ${r.from}.` : r.added.length ? `Added ${r.added.join(' and ')} to the Dubai zone.` : 'Express and 4-hour are already at checkout for Dubai.' };
  }
  if (action === 'express-fixed-off') {
    const r = await disableFixedRates(d.shopify);
    return { ok: true, message: r.removed ? 'Express and 4-hour removed from checkout; Dubai is back in the UAE zone.' : 'There was no Dubai zone to remove.' };
  }
  if (action === 'express-test-on') {
    const handle = String(form.get('handle') || '').trim().replace(/^.*\/products\//, '').replace(/[?#].*$/, '');
    if (!handle) return { ok: false, reason: 'Enter a product handle or link.' };
    const r = await enableTest(d.shopify, handle, d.cfg.express);
    const p = r.products[0];
    return { ok: true, message: `${r.already ? `The test is already on${r.widened ? ' (now delivers UAE-wide)' : r.added?.length ? ` (added ${r.added.join(', ')})` : r.changed ? ' (rates updated)' : ''}` : 'Test on'}: ${p?.title || ''}. This hidden copy offers standard delivery UAE-wide and Plaay Express where it reaches.` };
  }
  if (action === 'express-test-off') {
    const r = await disableTest(d.shopify);
    return { ok: true, message: `Test off: ${r.removedProfile ? 'delivery profile removed' : 'no profile'}; ${r.removedProducts.length ? `deleted ${r.removedProducts.join(', ')}` : 'no test product'}.` };
  }
  if (action === 'express-holidays') {
    const days = parseHolidays(form.get('holidays'));
    await setSetting(d.shopify, 'holidays', days.join(','));
    return { ok: true, message: days.length ? `No Express runs on ${days.join(', ')}.` : 'No holidays set.' };
  }
  if (action === 'express-rename-rate') {
    const from = String(form.get('from') || '').trim();
    const to = String(form.get('to') || '').trim();
    if (!from || !to) return { ok: false, reason: 'Give the current and the new rate name.' };
    const done = await renameRate(d.shopify, from, to);
    return { ok: true, message: done.length ? `Renamed “${from}” to “${to}” in ${done.join(', ')}.` : `No UAE rate is called “${from}”.` };
  }
  if (action === 'express-carrier-off') {
    const r = await disableCheckoutRates(d.shopify, d.cfg);
    return { ok: true, message: r.removed ? 'Checkout delivery rates removed.' : 'Checkout delivery rates were not connected.' };
  }
  return null;
}

export async function expressPageData(d) {
  const [status, s, test] = await Promise.all([checkoutStatus(d.shopify, d.cfg), liveSettings(d), testStatus(d.shopify).catch((err) => ({ error: err.message }))]);
  return { status, settings: s, areas: areaList(s), test };
}
