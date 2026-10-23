// HTTP handlers (Web Request -> Response). api/*.js wire these to Vercel routes.

import crypto from 'node:crypto';
import { TAGS } from './config.js';
import { cancelDispatch, dispatchOrder } from './dispatch.js';
import { defaultDeliveryMode, isExpressOrder, normalizePhone } from './mapping.js';
import { connectWebhooks, createManualOrder, createTestOrder, getConnection } from './setup.js';
import { verifyWebhookHmac } from './shopify.js';
import { applyTaskStatus, handleStatusUpdate, STATUS_LABELS, syncActiveOrders, toDegrees } from './status.js';
import { shopifyAdminUrl, VIEWS } from './orders.js';
import { trackingUrl, verifyTrackingToken } from './tracking.js';
import { renderDashboard, renderNewOrder, renderOrderDetail, renderTrackingPage } from './views.js';

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
      if (!isExpressOrder({ shippingLine: line && { title: line.title, code: line.code } }, d.cfg)) {
        return json({ skipped: 'not an express order' });
      }
      await d.shopify.addTags(payload.id, [TAGS.express]);
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
    if (!['connect', 'test-order', 'create-order'].includes(action) && !/^\d+$/.test(orderId)) return new Response('Bad order id', { status: 400 });

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
        const missing = [!f.name && 'name', !f.phone && 'a valid UAE phone number', f.address1.length < 5 && 'address'].filter(Boolean);
        if (missing.length) {
          result = { ok: false, reason: `Please enter ${missing.join(', ')}.` };
        } else {
          const order = await createManualOrder(d.shopify, f);
          form.set('back', `/order/${order.legacyResourceId}`);
          result = { ok: true, message: `Order ${order.name} created. Check the map pin, then dispatch when it's packed.` };
        }
      } else if (action === 'dispatch') result = await dispatchOrder(d, orderId, { mode: String(form.get('mode') || '') || undefined });
      else if (action === 'cancel') result = await cancelDispatch(d, orderId);
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
    const links = { shopify: shopifyAdminUrl(d.cfg, order.legacyResourceId), tracking: trackingUrl(d.cfg, order.legacyResourceId) };
    return html(renderOrderDetail({ order, task, taskError, cfg: d.cfg, flash, labels: STATUS_LABELS, links }));
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
  return html(renderDashboard({ orders, cfg: d.cfg, flash, labels: STATUS_LABELS, connection, view, q }));
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
