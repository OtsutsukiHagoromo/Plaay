import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleDashboard } from '../lib/handlers.js';
import { bucket, countByView, filterOrders, shopifyAdminUrl } from '../lib/orders.js';
import { cfg, fakeNoon, fakeShopify, makeOrder, quietLog } from './helpers.js';

const noon = (status, extra = {}) => ({ taskNr: status ? 'T1' : '', status, error: '', fulfillmentId: '', ...extra });

test('orders land in the right tab', () => {
  assert.equal(bucket(makeOrder()), 'todo');
  assert.equal(bucket(makeOrder({ noon: noon('assigned') })), 'active');
  assert.equal(bucket(makeOrder({ noon: noon('picked_up') })), 'active');
  assert.equal(bucket(makeOrder({ noon: noon('delivered') })), 'delivered');
  assert.equal(bucket(makeOrder({ noon: noon('undelivered') })), 'attention');
  assert.equal(bucket(makeOrder({ noon: noon('', { error: 'no map pin' }) })), 'attention');
  assert.equal(bucket(makeOrder({ noon: noon('cancelled') })), 'todo'); // can be booked again
  assert.equal(bucket(makeOrder({ cancelledAt: '2026-10-01T00:00:00Z' })), 'closed');
  assert.equal(bucket(makeOrder({ displayFulfillmentStatus: 'FULFILLED' })), 'closed');
});

test('counts and search', () => {
  const base = makeOrder();
  const orders = [
    makeOrder({ name: '#1001' }),
    makeOrder({ name: '#1002', noon: noon('assigned') }),
    makeOrder({ name: '#1003', noon: noon('delivered'), shippingAddress: { ...base.shippingAddress, name: 'Rahul Mehta', phone: '+971 55 111 2222', address2: 'Al Barsha' } }),
  ];
  assert.deepEqual(countByView(orders), { todo: 1, active: 1, attention: 0, delivered: 1, all: 3 });
  assert.deepEqual(filterOrders(orders, 'all', 'rahul').map((o) => o.name), ['#1003']);
  assert.deepEqual(filterOrders(orders, 'all', 'barsha').map((o) => o.name), ['#1003']);
  assert.deepEqual(filterOrders(orders, 'all', '055 111 2222').map((o) => o.name), ['#1003']);
  assert.deepEqual(filterOrders(orders, 'all', '1002').map((o) => o.name), ['#1002']);
  assert.deepEqual(filterOrders(orders, 'todo', '').map((o) => o.name), ['#1001']);
});

test('Shopify admin link', () => {
  const c = { ...cfg, shopify: { ...cfg.shopify, shop: 'plaay-store.myshopify.com' } };
  assert.equal(shopifyAdminUrl(c, '7319504060633'), 'https://admin.shopify.com/store/plaay-store/orders/7319504060633');
});

const auth = { authorization: `Basic ${Buffer.from('plaay:pw').toString('base64')}` };
const get = (path, d) => handleDashboard(new Request(`https://noon.example.com${path}`, { headers: auth }), d);

test('list: rows link to the order page, tabs and search apply', async () => {
  const shopify = fakeShopify(makeOrder());
  const d = { cfg, shopify, noon: fakeNoon(), log: quietLog };
  const todo = await (await get('/api/dashboard', d)).text();
  assert.match(todo, /href="\/order\/5550001"/);
  assert.match(todo, /class="tab on[^"]*" href="\/\?view=todo">To dispatch<span class="n">1</);
  const delivered = await (await get('/api/dashboard?view=delivered', d)).text();
  assert.doesNotMatch(delivered, /\/order\/5550001/);
  const searched = await (await get('/api/dashboard?view=all&q=nobody', d)).text();
  assert.match(searched, /No orders match “nobody”/);
  const bogusView = await get('/api/dashboard?view=<script>', d);
  assert.doesNotMatch(await bogusView.text(), /<script>.*view/);
});

test('order detail shows customer, items, links and live rider timeline', async () => {
  const shopify = fakeShopify(makeOrder({ noon: noon('picked_up', { taskNr: 'TASK9' }), lineItems: { nodes: [{ title: 'Triple Chocolate Truffles', quantity: 2 }] } }));
  const task = {
    status_code: 'picked_up',
    da_details: { name: 'Omar Khan', phone_number: '+971500000001', location: { latitude: '251998377', longitude: '552738694' } },
    da_updates: [{ status: 'assigned', time: '2026-10-21 13:05:00' }, { status: 'picked_up', time: '2026-10-21 13:20:00' }, { status: 'delivered', time: null }],
  };
  const d = { cfg, shopify, noon: fakeNoon({ task }), log: quietLog };
  const res = await get('/api/dashboard?order=5550001', d);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<h1>#1234<\/h1>/);
  assert.match(html, /2×<\/span>Triple Chocolate Truffles/);
  assert.match(html, /href="tel:\+971501234567"/);
  assert.match(html, /admin\.shopify\.com\/store\/[^"]*\/orders\/5550001/);
  assert.match(html, /\/track\/5550001\./);
  assert.match(html, /Omar Khan/);
  assert.match(html, /Rider assigned<\/span><span class="muted">21 Oct, 17:05/); // UTC -> Dubai
  assert.doesNotMatch(html, /Delivered<\/span><span class="muted">/); // no time yet, not shown
  assert.doesNotMatch(html, /Cancel rider/); // already picked up
});

test('order detail survives noon being down, and rejects bad ids', async () => {
  const shopify = fakeShopify(makeOrder({ noon: noon('assigned') }));
  const failing = { getTask: async () => { throw new Error('noon timeout'); } };
  const html = await (await get('/api/dashboard?order=5550001', { cfg, shopify, noon: failing, log: quietLog })).text();
  assert.match(html, /Could not reach noon: noon timeout/);
  assert.equal((await get('/api/dashboard?order=abc', { cfg, shopify, noon: failing, log: quietLog })).status, 400);
});

test('actions return to the page they came from, never off-site', async () => {
  const d = { cfg, shopify: fakeShopify(makeOrder()), noon: fakeNoon(), log: quietLog };
  const post = (back) =>
    handleDashboard(
      new Request('https://noon.example.com/api/dashboard', {
        method: 'POST',
        headers: { ...auth, origin: 'https://noon.example.com', 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ order: '5550001', action: 'dispatch', back }).toString(),
      }),
      d,
    );
  const toDetail = new URL((await post('/order/5550001')).headers.get('location'));
  assert.equal(toDetail.origin + toDetail.pathname, 'https://noon.example.com/order/5550001');
  for (const evil of ['//evil.example/x', 'https://evil.example', 'javascript:alert(1)']) {
    const loc = new URL((await post(evil)).headers.get('location'));
    assert.equal(loc.origin, 'https://noon.example.com');
  }
});
