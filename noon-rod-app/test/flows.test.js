import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { cancelDispatch, dispatchOrder } from '../lib/dispatch.js';
import { handleDashboard, handleNoonLocation, handleNoonStatus, handleShopifyWebhook, handleTrackData } from '../lib/handlers.js';
import { NoonError } from '../lib/noon.js';
import { handleStatusUpdate } from '../lib/status.js';
import { trackingToken } from '../lib/tracking.js';
import { cfg, fakeNoon, fakeShopify, makeOrder, quietLog } from './helpers.js';

const setup = (orderOverrides, noonOpts) => {
  const shopify = fakeShopify(makeOrder(orderOverrides));
  const noon = fakeNoon(noonOpts);
  const sleeps = [];
  return { d: { cfg, shopify, noon, log: quietLog, sleep: async (ms) => sleeps.push(ms) }, shopify, noon, sleeps };
};

// ---- dispatch ----

test('dispatch books a rider and records the task on the order', async () => {
  const { d, shopify, noon } = setup({ tags: ['noon-express', 'noon-dispatch'] });
  const r = await dispatchOrder(d, '5550001');
  assert.deepEqual(r, { ok: true, taskNr: 'TASK123', mode: 'standard' });
  assert.equal(noon.calls[0][2], 'plaay-5550001-first');
  assert.equal('delivery_mode' in noon.calls[0][1], false); // on-demand is noon's default
  assert.equal(shopify.order.noon.taskNr, 'TASK123');
  assert.equal(shopify.order.noon.status, 'created');
  assert.deepEqual(shopify.order.tags.sort(), ['noon-dispatched', 'noon-express']);
});

test('4-hour delivery: from the shipping method, or chosen by staff', async () => {
  const fourHour = setup({ shippingLine: { title: '4-hour delivery', code: '4hr' } });
  assert.equal((await dispatchOrder(fourHour.d, '5550001')).mode, '4hr_delivery');
  assert.equal(fourHour.noon.calls[0][1].delivery_mode, '4hr_delivery');
  assert.equal(fourHour.shopify.order.noon.mode, '4hr_delivery');

  const picked = setup();
  await dispatchOrder(picked.d, '5550001', { mode: '4hr_delivery' });
  assert.equal(picked.noon.calls[0][1].delivery_mode, '4hr_delivery');

  const bogus = setup();
  await dispatchOrder(bogus.d, '5550001', { mode: 'teleport' });
  assert.equal('delivery_mode' in bogus.noon.calls[0][1], false);
});

test('dispatch is a no-op when a rider is already booked', async () => {
  const { d, noon } = setup({ noon: { taskNr: 'T1', status: 'assigned', error: '', fulfillmentId: '' } });
  const r = await dispatchOrder(d, '5550001');
  assert.equal(r.already, true);
  assert.equal(noon.calls.length, 0);
});

test('re-booking after a cancel uses a fresh idempotency key and clears old state', async () => {
  const { d, shopify, noon } = setup({
    tags: ['noon-express', 'noon-cancelled'],
    noon: { taskNr: 'OLD1', status: 'cancelled', error: '', fulfillmentId: 'gid://shopify/Fulfillment/1' },
  });
  await dispatchOrder(d, '5550001');
  assert.equal(noon.calls[0][2], 'plaay-5550001-OLD1');
  assert.equal(shopify.order.noon.fulfillmentId, '');
  assert.ok(!shopify.order.tags.includes('noon-cancelled'));
});

test('bad address data is surfaced to staff instead of calling noon', async () => {
  const base = makeOrder();
  const { d, shopify, noon } = setup({
    tags: ['noon-express', 'noon-dispatch'],
    shippingAddress: { ...base.shippingAddress, latitude: null },
  });
  const r = await dispatchOrder(d, '5550001');
  assert.equal(r.ok, false);
  assert.equal(noon.calls.length, 0);
  assert.match(shopify.order.noon.error, /map coordinates/);
  assert.deepEqual(shopify.order.tags.sort(), ['noon-error', 'noon-express']);
});

test('noon 4xx (e.g. out of range) is surfaced; 5xx is thrown for retry', async () => {
  const a = setup({}, { createError: { status: 422, message: 'distance limit exceeded' } });
  const r = await dispatchOrder(a.d, '5550001');
  assert.equal(r.ok, false);
  assert.ok(a.shopify.order.tags.includes('noon-error'));

  const b = setup({}, { createError: { status: 503, message: 'down' } });
  await assert.rejects(dispatchOrder(b.d, '5550001'), /down/);
});

test('cancelled Shopify orders are never dispatched', async () => {
  const { d, noon } = setup({ cancelledAt: '2026-09-30T09:00:00Z' });
  assert.equal((await dispatchOrder(d, '5550001')).ok, false);
  assert.equal(noon.calls.length, 0);
});

// ---- cancel ----

test('cancel works before pickup and is refused after', async () => {
  const live = { taskNr: 'T1', status: 'assigned', error: '', fulfillmentId: '' };
  const a = setup({ tags: ['noon-express', 'noon-dispatched'], noon: { ...live } }, { taskStatus: 'assigned' });
  assert.equal((await cancelDispatch(a.d, '5550001')).ok, true);
  assert.deepEqual(a.noon.calls.map((c) => c[0]), ['getTask', 'cancelTask']);
  assert.equal(a.shopify.order.noon.status, 'cancelled');
  assert.ok(!a.shopify.order.tags.includes('noon-dispatched'));

  const b = setup({ noon: { ...live, status: 'picked_up' } }, { taskStatus: 'picked_up' });
  const r = await cancelDispatch(b.d, '5550001');
  assert.equal(r.ok, false);
  assert.ok(!b.noon.calls.some((c) => c[0] === 'cancelTask'));
});

// ---- status webhooks ----

const booked = { tags: ['noon-express', 'noon-dispatched'], noon: { taskNr: 'TASK123', status: 'assigned', error: '', fulfillmentId: '' } };
const update = (status) => ({ order_nr: 'TASK123', status_code: status, order_reference: '#1234', timestamp: '2026-09-30 12:00:00' });

test('picked_up fulfils the order with a tracking link and notifies the customer', async () => {
  const { d, shopify } = setup(booked, { taskStatus: 'picked_up' });
  await handleStatusUpdate(d, update('picked_up'));
  const fulfil = shopify.calls.find((c) => c[0] === 'createFulfillment')[1];
  assert.equal(fulfil.notifyCustomer, true);
  assert.equal(fulfil.taskNr, 'TASK123');
  assert.equal(fulfil.trackingUrl, `https://noon.example.com/track/${trackingToken('track-secret', '5550001')}`);
  assert.deepEqual(shopify.calls.find((c) => c[0] === 'createFulfillmentEvent').slice(2), ['OUT_FOR_DELIVERY']);
  assert.equal(shopify.order.noon.fulfillmentId, 'gid://shopify/Fulfillment/77');
});

test('delivered marks the fulfillment delivered (creating it silently if pickup was missed)', async () => {
  const { d, shopify } = setup(booked, { taskStatus: 'delivered' });
  await handleStatusUpdate(d, update('delivered'));
  assert.equal(shopify.calls.find((c) => c[0] === 'createFulfillment')[1].notifyCustomer, false);
  assert.deepEqual(shopify.calls.find((c) => c[0] === 'createFulfillmentEvent').slice(2), ['DELIVERED']);
  assert.ok(shopify.order.tags.includes('noon-delivered'));
});

test('out-of-order and stale webhooks are ignored', async () => {
  const late = setup({ ...booked, noon: { ...booked.noon, status: 'picked_up' } }, { taskStatus: 'assigned' });
  assert.match((await handleStatusUpdate(late.d, update('assigned'))).ignored, /out-of-order/);
  assert.equal(late.shopify.calls.length, 0);

  const stale = setup(booked);
  assert.match((await handleStatusUpdate(stale.d, { ...update('delivered'), order_nr: 'OLD' })).ignored, /stale/);
  assert.equal(stale.shopify.calls.length, 0);
});

test('undelivered flags the order and frees it for re-booking', async () => {
  const { d, shopify } = setup({ ...booked, noon: { ...booked.noon, status: 'picked_up', fulfillmentId: 'F1' } }, { taskStatus: 'undelivered' });
  await handleStatusUpdate(d, update('undelivered'));
  assert.deepEqual(shopify.calls.find((c) => c[0] === 'createFulfillmentEvent').slice(1), ['F1', 'FAILURE']);
  assert.ok(shopify.order.tags.includes('noon-undelivered'));
  assert.ok(!shopify.order.tags.includes('noon-dispatched'));
});

// ---- HTTP handlers ----

function shopifyRequest(topic, payload, secret = 'shopify-secret') {
  const body = JSON.stringify(payload);
  return new Request('https://noon.example.com/api/shopify-webhook', {
    method: 'POST',
    body,
    headers: {
      'x-shopify-topic': topic,
      'x-shopify-hmac-sha256': crypto.createHmac('sha256', secret).update(body).digest('base64'),
    },
  });
}

test('Shopify webhook rejects bad signatures', async () => {
  const { d } = setup();
  const res = await handleShopifyWebhook(shopifyRequest('orders/create', { id: 1 }, 'wrong'), d);
  assert.equal(res.status, 401);
});

test('orders/create tags express orders; orders/updated with noon-dispatch books a rider', async () => {
  const { d, shopify, noon } = setup({ tags: [] });
  await handleShopifyWebhook(shopifyRequest('orders/create', { id: 5550001, tags: '', shipping_lines: [{ title: 'Express delivery', code: 'x' }] }), d);
  assert.ok(shopify.order.tags.includes('noon-express'));
  assert.equal(noon.calls.length, 0); // AUTO_DISPATCH is off

  await handleShopifyWebhook(shopifyRequest('orders/create', { id: 5550001, tags: '', shipping_lines: [{ title: 'Standard', code: 's' }] }), d);

  const res = await handleShopifyWebhook(shopifyRequest('orders/updated', { id: 5550001, tags: 'noon-express, noon-dispatch' }), d);
  assert.equal((await res.json()).taskNr, 'TASK123');

  // Our own tag changes fire orders/updated again; that must not book a second rider.
  await handleShopifyWebhook(shopifyRequest('orders/updated', { id: 5550001, tags: 'noon-express, noon-dispatched' }), d);
  assert.equal(noon.calls.filter((c) => c[0] === 'createTask').length, 1);
});

test('noon webhook key: optional on staging (noon staging cannot send it), required on production', async () => {
  const req = (path, key) =>
    new Request(`https://noon.example.com/api/${path}`, {
      method: 'POST',
      body: JSON.stringify(update('assigned')),
      headers: key ? { 'x-api-key': key } : {},
    });
  const staging = setup(booked, { taskStatus: 'assigned' }).d; // test cfg points at noon staging
  assert.equal((await handleNoonStatus(req('noon-status'), staging)).status, 200);
  assert.equal((await handleNoonStatus(req('noon-status', 'noon-secret'), staging)).status, 200);
  assert.equal((await handleNoonStatus(req('noon-status', 'nope'), staging)).status, 401);
  assert.equal((await handleNoonLocation(req('noon-location'), staging)).status, 200);

  const prod = { ...staging, cfg: { ...cfg, noon: { ...cfg.noon, baseUrl: 'https://food-api-team.noon.team' } } };
  assert.equal((await handleNoonStatus(req('noon-status'), prod)).status, 401);
  assert.equal((await handleNoonLocation(req('noon-location'), prod)).status, 401);
  assert.equal((await handleNoonStatus(req('noon-status', 'nope'), prod)).status, 401);
  assert.equal((await handleNoonStatus(req('noon-status', 'noon-secret'), prod)).status, 200);
});

test('a forged webhook cannot mark an order delivered: the status comes from noon\'s API', async () => {
  const { d, shopify, noon } = setup(booked, { taskStatus: 'assigned' });
  const r = await handleStatusUpdate(d, update('delivered'));
  assert.equal(r.status, 'assigned');
  assert.deepEqual(noon.calls[0], ['getTask', 'TASK123']);
  assert.ok(!shopify.calls.some((c) => c[0] === 'createFulfillment' || c[0] === 'createFulfillmentEvent'));
  assert.ok(!shopify.order.tags.includes('noon-delivered'));
});

test('unknown tasks, and tasks from other orders, are ignored', async () => {
  const notOurs = setup({}, { task: { status_code: 'delivered', order_id: '#9999 - TASK123' } });
  assert.match((await handleStatusUpdate(notOurs.d, update('delivered'))).ignored, /does not belong/);
  assert.equal(notOurs.shopify.calls.length, 0);

  const ours = setup({}, { task: { status_code: 'assigned', order_id: '#1234 - TASK123' } });
  assert.equal((await handleStatusUpdate(ours.d, update('assigned'))).status, 'assigned');

  const unknown = setup(booked);
  unknown.noon.getTask = async () => { throw new NoonError('not found', 404, null); };
  assert.match((await handleStatusUpdate(unknown.d, update('delivered'))).ignored, /unknown task/);
  const down = setup(booked);
  down.noon.getTask = async () => { throw new NoonError('down', 503, null); };
  await assert.rejects(handleStatusUpdate(down.d, update('delivered')), /down/); // retried by noon
});

test('dashboard needs the password and blocks cross-site posts', async () => {
  const { d, noon } = setup();
  const auth = { authorization: `Basic ${Buffer.from('plaay:pw').toString('base64')}` };
  assert.equal((await handleDashboard(new Request('https://noon.example.com/'), d)).status, 401);

  const page = await handleDashboard(new Request('https://noon.example.com/', { headers: auth }), d);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /#1234/);

  const post = (origin) =>
    new Request('https://noon.example.com/api/dashboard', {
      method: 'POST',
      headers: { ...auth, origin, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'order=5550001&action=dispatch',
    });
  assert.equal((await handleDashboard(post('https://evil.example'), d)).status, 403);
  assert.equal(noon.calls.length, 0);
  const ok = await handleDashboard(post('https://noon.example.com'), d);
  assert.equal(ok.status, 303);
  assert.equal(new URL(ok.headers.get('location')).searchParams.get('msg'), 'Rider booked (TASK123)');
});

test('tracking data converts noon coordinates and hides the rider phone until pickup', async () => {
  const task = (status) => ({
    status_code: status,
    da_details: { first_name: 'Omar', phone_number: '+971500000001', location: { latitude: '251998377', longitude: '552738694' } },
  });
  const get = async (status) => {
    const { d } = setup(booked, { task: task(status) });
    const req = new Request(`https://noon.example.com/api/track-data?t=${trackingToken('track-secret', '5550001')}`);
    return (await handleTrackData(req, d)).json();
  };
  const assigned = await get('assigned');
  assert.equal(assigned.label, 'Rider assigned');
  assert.equal(assigned.rider.lat, 25.1998377);
  assert.equal(assigned.rider.phone, null);
  assert.equal((await get('picked_up')).rider.phone, '+971500000001');

  const { d } = setup(booked);
  assert.equal((await handleTrackData(new Request('https://noon.example.com/api/track-data?t=5550001.bad'), d)).status, 404);
});

// ---- noon's API lagging behind its own webhooks (seen with test order #20537) ----

test('webhook ahead of noon\'s API: re-checks until the API catches up', async () => {
  const { d, shopify, sleeps } = setup({ ...booked, noon: { ...booked.noon, status: 'arrived_at_delivery', fulfillmentId: 'F1' } }, { sequence: ['arrived_at_delivery', 'arrived_at_delivery', 'delivered'] });
  const r = await handleStatusUpdate(d, update('delivered'));
  assert.equal(r.status, 'delivered');
  assert.deepEqual(sleeps, [1000, 2000]);
  assert.deepEqual(shopify.calls.find((c) => c[0] === 'createFulfillmentEvent').slice(1), ['F1', 'DELIVERED']);
  assert.ok(shopify.order.tags.includes('noon-delivered'));
});

test('re-checks are bounded when the API never confirms (e.g. a forged webhook)', async () => {
  const { d, shopify, sleeps } = setup(booked, { taskStatus: 'assigned' });
  const r = await handleStatusUpdate(d, update('delivered'));
  assert.equal(r.status, 'assigned');
  assert.equal(sleeps.length, 3);
  assert.ok(!shopify.order.tags.includes('noon-delivered'));
});

test('no re-check when the API already agrees', async () => {
  const { d, sleeps } = setup(booked, { taskStatus: 'picked_up' });
  await handleStatusUpdate(d, update('picked_up'));
  assert.deepEqual(sleeps, []);
});

test('dashboard list catches up orders whose webhooks were missed', async () => {
  const stuck = { ...booked, noon: { ...booked.noon, status: 'arrived_at_delivery', fulfillmentId: 'F1' } };
  const { d, shopify, noon } = setup(stuck, { taskStatus: 'delivered' });
  const auth = { authorization: `Basic ${Buffer.from('plaay:pw').toString('base64')}` };
  shopify.listOrdersByTag = async () => [structuredClone(shopify.order)];
  shopify.graphql = async () => ({
    shop: { name: 'Plaay', myshopifyDomain: 'p.myshopify.com' },
    currentAppInstallation: { app: { title: 'TMS' }, accessScopes: [{ handle: 'write_orders' }, { handle: 'write_merchant_managed_fulfillment_orders' }] },
    webhookSubscriptions: { nodes: ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED'].map((topic) => ({ topic, uri: 'https://noon.example.com/api/shopify-webhook' })) },
  });
  const html = await (await handleDashboard(new Request('https://noon.example.com/?view=delivered', { headers: auth }), d)).text();
  assert.deepEqual(noon.calls.find((c) => c[0] === 'getTasks'), ['getTasks', ['TASK123']]);
  assert.ok(shopify.order.tags.includes('noon-delivered'));
  assert.match(html, /Delivered<span class="n">1</);
});

test('opening an order page catches it up too', async () => {
  const stuck = { ...booked, noon: { ...booked.noon, status: 'arrived_at_delivery', fulfillmentId: 'F1' } };
  const { d, shopify } = setup(stuck, { taskStatus: 'delivered' });
  const auth = { authorization: `Basic ${Buffer.from('plaay:pw').toString('base64')}` };
  const html = await (await handleDashboard(new Request('https://noon.example.com/api/dashboard?order=5550001', { headers: auth }), d)).text();
  assert.equal(shopify.order.noon.status, 'delivered');
  assert.match(html, /<span class="b ok">Delivered<\/span>/);
});

test('dashboard sync never moves an order backwards and tolerates noon errors', async () => {
  const { d, shopify } = setup({ ...booked, noon: { ...booked.noon, status: 'picked_up' } }, { taskStatus: 'assigned' });
  const { syncActiveOrders } = await import('../lib/status.js');
  assert.equal(await syncActiveOrders(d, [structuredClone(shopify.order)]), 0);
  d.noon.getTasks = async () => { throw new Error('noon down'); };
  assert.equal(await syncActiveOrders(d, [structuredClone(shopify.order)]), 0);
  assert.equal(shopify.order.noon.status, 'picked_up');
});

test('orders/create: Express beyond the road limit goes 4-hour; subscriptions are not Express', async () => {
  const far = setup({ tags: [] });
  far.d.geo = { drivingKm: async () => 26 };
  const ship = { shipping_lines: [{ title: 'Plaay Express (Dubai, within 20 km)', code: 'x' }], shipping_address: { latitude: 25.19, longitude: 55.27 } };
  await handleShopifyWebhook(shopifyRequest('orders/create', { id: 5550001, tags: '', ...ship }), far.d);
  assert.ok(far.shopify.order.tags.includes('express-out-of-range'));
  assert.equal(far.shopify.order.noon.mode, '4hr_delivery');

  const near = setup({ tags: [] });
  near.d.geo = { drivingKm: async () => 14 };
  await handleShopifyWebhook(shopifyRequest('orders/create', { id: 5550001, tags: '', ...ship }), near.d);
  assert.ok(!near.shopify.order.tags.includes('express-out-of-range'));

  const sub = setup({ tags: [] });
  await handleShopifyWebhook(shopifyRequest('orders/create', { id: 5550001, tags: '', ...ship, line_items: [{ selling_plan_allocation: { selling_plan: { id: 1 } } }] }), sub.d);
  assert.ok(!sub.shopify.order.tags.includes('noon-express'));
});
