import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleDashboard } from '../lib/handlers.js';
import { connectWebhooks, getConnection } from '../lib/setup.js';
import { cfg, fakeNoon, fakeShopify, makeOrder, quietLog } from './helpers.js';

test('connection check reports missing scopes and webhooks', async () => {
  const shopify = fakeShopify(makeOrder());
  let c = await getConnection(shopify, cfg);
  assert.equal(c.ok, true);
  assert.deepEqual(c.missingScopes, []); // write_* implies read_*
  assert.deepEqual(c.missingWebhooks, ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED']);

  shopify.scopes = ['read_orders'];
  c = await getConnection(shopify, cfg);
  assert.deepEqual(c.missingScopes, ['write_orders', 'read_merchant_managed_fulfillment_orders', 'write_merchant_managed_fulfillment_orders']);
});

test('connection check never throws', async () => {
  const c = await getConnection({ graphql: async () => { throw new Error('token request failed (401)'); } }, cfg);
  assert.deepEqual(c, { ok: false, error: 'token request failed (401)' });
});

test('connectWebhooks only registers what is missing', async () => {
  const shopify = fakeShopify(makeOrder());
  const first = await connectWebhooks(shopify, cfg);
  assert.deepEqual(first.map((r) => r.topic), ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED']);
  assert.ok(shopify.webhooks.every((w) => w.uri === 'https://noon.example.com/api/shopify-webhook'));
  assert.deepEqual(await connectWebhooks(shopify, cfg), []);
});

test('dashboard Connect Shopify button registers webhooks', async () => {
  const shopify = fakeShopify(makeOrder());
  const d = { cfg, shopify, noon: fakeNoon(), log: quietLog };
  const auth = { authorization: `Basic ${Buffer.from('plaay:pw').toString('base64')}` };

  const before = await (await handleDashboard(new Request('https://noon.example.com/', { headers: auth }), d)).text();
  assert.match(before, /Connect Shopify/);

  const res = await handleDashboard(
    new Request('https://noon.example.com/api/dashboard', {
      method: 'POST',
      headers: { ...auth, origin: 'https://noon.example.com', 'content-type': 'application/x-www-form-urlencoded' },
      body: 'action=connect',
    }),
    d,
  );
  assert.equal(new URL(res.headers.get('location')).searchParams.get('msg'), 'Shopify connected');

  const after = await (await handleDashboard(new Request('https://noon.example.com/', { headers: auth }), d)).text();
  // Fully connected: no setup panel at all.
  assert.doesNotMatch(after, /Connect Shopify|class="panel/);
});

test('dashboard still renders when Shopify is unreachable', async () => {
  const shopify = fakeShopify(makeOrder());
  shopify.graphql = async () => { throw new Error('Shopify token request failed (400)'); };
  const d = { cfg, shopify, noon: fakeNoon(), log: quietLog };
  const auth = { authorization: `Basic ${Buffer.from('plaay:pw').toString('base64')}` };
  const res = await handleDashboard(new Request('https://noon.example.com/', { headers: auth }), d);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Shopify is not connected[\s\S]*token request failed/);
});

test('test orders: created on staging, refused on production', async () => {
  const shopify = fakeShopify(makeOrder());
  const real = shopify.graphql.bind(shopify);
  const mutations = [];
  shopify.graphql = async (query, vars) => {
    if (query.includes('draftOrderCreate')) {
      mutations.push(vars.input);
      return { draftOrderCreate: { draftOrder: { id: 'gid://shopify/DraftOrder/9' }, userErrors: [] } };
    }
    if (query.includes('draftOrderComplete')) {
      return { draftOrderComplete: { draftOrder: { order: { id: 'gid://shopify/Order/1', name: '#9001', legacyResourceId: '1' } }, userErrors: [] } };
    }
    return real(query, vars);
  };
  const auth = { authorization: `Basic ${Buffer.from('plaay:pw').toString('base64')}` };
  const post = () =>
    new Request('https://noon.example.com/api/dashboard', {
      method: 'POST',
      headers: { ...auth, origin: 'https://noon.example.com', 'content-type': 'application/x-www-form-urlencoded' },
      body: 'action=test-order',
    });

  const res = await handleDashboard(post(), { cfg, shopify, noon: fakeNoon(), log: quietLog });
  assert.match(new URL(res.headers.get('location')).searchParams.get('msg'), /Test order #9001 created/);
  assert.match(mutations[0].shippingLine.title, /express/i); // so the app treats it as an express order
  assert.deepEqual(mutations[0].tags, ['noon-express', 'noon-manual', 'test', 'noon-test']);
  assert.equal(mutations[0].email, undefined); // no customer emails

  const prodCfg = { ...cfg, noon: { ...cfg.noon, baseUrl: 'https://food-api-team.noon.team' } };
  assert.equal((await handleDashboard(post(), { cfg: prodCfg, shopify, noon: fakeNoon(), log: quietLog })).status, 403);
  assert.equal(mutations.length, 1);
});

test('New order form: validates, creates a paid order and opens it', async () => {
  const shopify = fakeShopify(makeOrder());
  const inputs = [];
  shopify.graphql = async (query, vars) => {
    if (query.includes('draftOrderCreate')) {
      inputs.push(vars.input);
      return { draftOrderCreate: { draftOrder: { id: 'gid://shopify/DraftOrder/9' }, userErrors: [] } };
    }
    return { draftOrderComplete: { draftOrder: { order: { id: 'gid://shopify/Order/77', name: '#20600', legacyResourceId: '77' } }, userErrors: [] } };
  };
  const auth = { authorization: `Basic ${Buffer.from('plaay:pw').toString('base64')}` };
  const post = (fields) =>
    handleDashboard(
      new Request('https://noon.example.com/api/dashboard', {
        method: 'POST',
        headers: { ...auth, origin: 'https://noon.example.com', 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'create-order', back: '/new', ...fields }).toString(),
      }),
      { cfg, shopify, noon: fakeNoon(), log: quietLog },
    );

  const bad = new URL((await post({ name: '', phone: '123', address1: 'x' })).headers.get('location'));
  assert.equal(bad.pathname, '/new');
  assert.match(bad.searchParams.get('msg'), /name, a valid UAE phone number, address/);
  assert.equal(inputs.length, 0);

  const ok = new URL((await post({ name: 'Anam Khan', phone: '0568856365', address1: 'SS Lootah 2, 308, Building 59, 19C Street', area: 'Al Qusais', item: 'Truffles', amount: '238', mode: '4hr_delivery' })).headers.get('location'));
  assert.equal(ok.pathname, '/order/77');
  assert.match(ok.searchParams.get('msg'), /Order #20600 created/);
  const input = inputs[0];
  assert.equal(input.shippingLine.title, '4-hour delivery');
  assert.equal(input.shippingAddress.phone, '+971568856365');
  assert.equal(input.shippingAddress.firstName, 'Anam');
  assert.equal(input.shippingAddress.lastName, 'Khan');
  assert.equal(input.shippingAddress.address2, 'Al Qusais');
  assert.equal(input.lineItems[0].originalUnitPriceWithCurrency.amount, '238.00');
  assert.ok(input.tags.includes('noon-express'));
  assert.ok(!input.tags.includes('test'));
  assert.equal(input.email, undefined);
});

test('New order page renders and offers both services', async () => {
  const auth = { authorization: `Basic ${Buffer.from('plaay:pw').toString('base64')}` };
  const res = await handleDashboard(new Request('https://noon.example.com/api/dashboard?new=1', { headers: auth }), { cfg, shopify: fakeShopify(makeOrder()), noon: fakeNoon(), log: quietLog });
  const html = await res.text();
  assert.match(html, /name="mode" value="standard" checked/);
  assert.match(html, /value="4hr_delivery"/);
});
