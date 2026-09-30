// HTTP handlers (Web Request -> Response). api/*.js wire these to Vercel routes.

import crypto from 'node:crypto';
import { TAGS } from './config.js';
import { cancelDispatch, dispatchOrder } from './dispatch.js';
import { isExpressOrder } from './mapping.js';
import { verifyWebhookHmac } from './shopify.js';
import { handleStatusUpdate, STATUS_LABELS, toDegrees } from './status.js';
import { verifyTrackingToken } from './tracking.js';
import { renderDashboard, renderTrackingPage } from './views.js';

const json = (body, status = 200) => Response.json(body, { status });

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

// ---- noon webhooks (noon sends our NOON_WEBHOOK_KEY as X-API-Key) ----

function noonAuthorized(request, d) {
  return safeEqual(request.headers.get('x-api-key'), d.cfg.noon.webhookKey);
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
    if (!/^\d+$/.test(orderId)) return new Response('Bad order id', { status: 400 });

    let result;
    try {
      if (action === 'dispatch') result = await dispatchOrder(d, orderId);
      else if (action === 'cancel') result = await cancelDispatch(d, orderId);
      else return new Response('Unknown action', { status: 400 });
      flash = result.ok ? `${action === 'dispatch' ? 'Rider booked' : 'Rider cancelled'}${result.taskNr ? ` (${result.taskNr})` : ''}` : `Failed: ${result.reason}`;
    } catch (err) {
      d.log.error?.(err);
      flash = `Failed: ${err.message}`;
    }
    const back = new URL('/', url.origin);
    back.searchParams.set('msg', flash);
    return Response.redirect(back.toString(), 303);
  }

  const orders = await d.shopify.listOrdersByTag(TAGS.express);
  return new Response(renderDashboard({ orders, cfg: d.cfg, flash, labels: STATUS_LABELS }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
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
  const body = { order: order.name, status: order.noon.status || 'not_dispatched', rider: null, drop };

  if (order.noon.taskNr) {
    const task = await d.noon.getTask(order.noon.taskNr).catch(() => null);
    if (task) {
      body.status = task.status_code || body.status;
      const da = task.da_details;
      if (da) {
        body.rider = {
          name: da.first_name || da.name || 'Your rider',
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
