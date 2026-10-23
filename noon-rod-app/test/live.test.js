import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLive, lateSeconds, noonTime } from '../lib/live.js';
import { makeOrder } from './helpers.js';

test('parses noon times (UTC, no zone, microseconds)', () => {
  assert.equal(noonTime('2026-10-23 12:17:02.000000').toISOString(), '2026-10-23T12:17:02.000Z');
  assert.equal(noonTime('2026-10-23T12:16:35').toISOString(), '2026-10-23T12:16:35.000Z');
  assert.equal(noonTime(null), null);
  assert.equal(noonTime('garbage'), null);
});

test('parses noon lateness', () => {
  assert.equal(lateSeconds('-00:01:34.000000'), -94);
  assert.equal(lateSeconds('00:05:00'), 300);
  assert.equal(lateSeconds(null), null);
});

// Shape of noon production task HGANNN4KVOLJ3VWP (order #20541) right after assignment.
const assignedTask = {
  status_code: 'assigned',
  created_at: '2026-10-23T12:16:35',
  da_details: {
    name: 'Niyaz Ahmed',
    phone_number: '+971-589774557',
    location: { latitude: '249872100', longitude: '551876867' },
    proximity: { pickup: { distance: 2442.7, duration: 240.5 }, drop_off: { distance: 15283.2, duration: 1007.9 } },
  },
  restaurant_details: { location: { latitude: '249811042', longitude: '552066267' } },
  customer_details: { location: { latitude: '250475330', longitude: '552494870' } },
  da_updates: [
    { status: 'assigned', time: '2026-10-23 12:17:02.000000', late: '-00:01:34.000000' },
    { status: 'picked_up', time: null, late: null },
    { current_status: 'Assigned' },
  ],
};

test('assigned: rider, three map points and both ETAs', () => {
  const now = new Date('2026-10-23T12:20:00Z');
  const live = buildLive(makeOrder({ noon: { taskNr: 'T', status: 'assigned', error: '', fulfillmentId: '', mode: '' } }), assignedTask, now);
  assert.equal(live.label, 'Rider assigned');
  assert.equal(live.dispatchedAt, '2026-10-23T12:16:35.000Z');
  assert.deepEqual(live.stages, { assigned: { at: '2026-10-23T12:17:02.000Z', late: -94 } });
  assert.deepEqual(live.rider.pos, { lat: 24.98721, lng: 55.1876867 });
  assert.deepEqual(live.warehouse, { lat: 24.9811042, lng: 55.2066267 });
  assert.deepEqual(live.customer, { lat: 25.047533, lng: 55.249487 });
  assert.equal(live.etaPickup.meters, 2443);
  assert.equal(live.etaPickup.at, '2026-10-23T12:24:00.500Z');
  assert.equal(live.etaCustomer.seconds, 1008);
  assert.equal(live.finished, false);
});

test('after pickup only the customer ETA remains; delivered shows no rider or ETA', () => {
  const order = makeOrder();
  const pickedUp = buildLive(order, { ...assignedTask, status_code: 'picked_up' });
  assert.equal(pickedUp.etaPickup, null);
  assert.ok(pickedUp.etaCustomer);
  const delivered = buildLive(order, { ...assignedTask, status_code: 'delivered' });
  assert.equal(delivered.finished, true);
  assert.equal(delivered.rider, null);
  assert.equal(delivered.etaCustomer, null);
});

test('without a task the customer pin falls back to the Shopify address', () => {
  const live = buildLive(makeOrder(), null);
  assert.deepEqual(live.customer, { lat: 25.0877, lng: 55.1477 });
  assert.equal(live.rider, null);
});

test('live endpoint is behind the dashboard password', async () => {
  const { handleDashboard } = await import('../lib/handlers.js');
  const { cfg, fakeShopify, fakeNoon, quietLog } = await import('./helpers.js');
  const d = { cfg, shopify: fakeShopify(makeOrder({ noon: { taskNr: 'T', status: 'assigned', error: '', fulfillmentId: '', mode: '' } })), noon: fakeNoon({ task: assignedTask }), log: quietLog };
  assert.equal((await handleDashboard(new Request('https://noon.example.com/api/dashboard?order=5550001&live=1'), d)).status, 401);
  const auth = { authorization: `Basic ${Buffer.from('plaay:pw').toString('base64')}` };
  const res = await handleDashboard(new Request('https://noon.example.com/api/dashboard?order=5550001&live=1', { headers: auth }), d);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'assigned');
  assert.ok(body.rider.pos && body.warehouse && body.customer);
});
