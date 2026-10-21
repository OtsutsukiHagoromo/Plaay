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
  assert.match(after, /Connected to <strong>Plaay<\/strong>/);
  assert.doesNotMatch(after, /<button>Connect Shopify/);
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
  assert.deepEqual(mutations[0].tags, ['test', 'noon-test']);
  assert.equal(mutations[0].email, undefined); // no customer emails

  const prodCfg = { ...cfg, noon: { ...cfg.noon, baseUrl: 'https://food-api-team.noon.team' } };
  assert.equal((await handleDashboard(post(), { cfg: prodCfg, shopify, noon: fakeNoon(), log: quietLog })).status, 403);
  assert.equal(mutations.length, 1);
});
