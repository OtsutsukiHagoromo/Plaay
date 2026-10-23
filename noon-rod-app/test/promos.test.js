import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPromotion } from '../lib/promos.js';

const CATALOG = ['og-plaayer-pack', 'plaayer-pack', 'bar-bunch', 'new-chocolate-slabs-mix-pack-of-6', 'truffle-mix', 'triple-chocolate-truffle', 'plaay-70-dark-chocolate-bar-6-x-80g'];

function fakeShop({ existing = [], products = CATALOG } = {}) {
  const created = [];
  const deleted = [];
  return {
    created,
    deleted,
    async graphql(query, vars) {
      if (query.includes('automaticDiscountNodes')) return { automaticDiscountNodes: { nodes: [...existing, ...created].filter((d) => !deleted.includes(d.id)).map((d) => ({ id: d.id, automaticDiscount: d })) } };
      if (query.includes('discountAutomaticBasicUpdate')) return { discountAutomaticBasicUpdate: { userErrors: [] } };
      if (query.includes('discountAutomaticDelete')) {
        deleted.push(vars.id);
        return { discountAutomaticDelete: { deletedAutomaticDiscountId: vars.id, userErrors: [] } };
      }
      if (query.includes('products(first: 250')) return { products: { nodes: products.map((h) => ({ id: `gid://shopify/Product/${h}`, handle: h, title: h })), pageInfo: { hasNextPage: false, endCursor: null } } };
      if (query.includes('products(')) {
        const wanted = vars.q.split(' OR ').map((s) => s.replace('handle:', ''));
        return { products: { nodes: wanted.filter((h) => products.includes(h)).map((h) => ({ id: `gid://shopify/Product/${h}`, handle: h, title: h })) } };
      }
      if (query.includes('discountAutomaticBasicCreate')) {
        created.push({ id: `gid://new/${created.length + 1}`, title: vars.d.title, input: vars.d });
        return { discountAutomaticBasicCreate: { automaticDiscountNode: { id: `gid://new/${created.length}` }, userErrors: [] } };
      }
      throw new Error('unexpected query');
    },
  };
}

const now = new Date('2026-10-23T20:40:00Z');

test('creates three tiers with the right products, percentages, dates and combinations', async () => {
  const shop = fakeShop();
  const r = await createPromotion(shop, 'halloween-2026', now);
  assert.equal(r.length, 3);
  const [v, m, all] = shop.created.map((c) => c.input);
  assert.equal(v.customerGets.value.percentage, 0.3);
  assert.deepEqual(v.customerGets.items.products.productsToAdd, ['gid://shopify/Product/og-plaayer-pack', 'gid://shopify/Product/plaayer-pack', 'gid://shopify/Product/bar-bunch']);
  assert.equal(m.customerGets.value.percentage, 0.25);
  assert.deepEqual(m.customerGets.items.products.productsToAdd, ['gid://shopify/Product/new-chocolate-slabs-mix-pack-of-6', 'gid://shopify/Product/truffle-mix']);
  assert.equal(all.customerGets.value.percentage, 0.2);
  // Disjoint: the 20% lists every other product, never the 30% / 25% packs.
  assert.deepEqual(all.customerGets.items.products.productsToAdd, ['gid://shopify/Product/triple-chocolate-truffle', 'gid://shopify/Product/plaay-70-dark-chocolate-bar-6-x-80g']);
  for (const d of [v, m, all]) {
    assert.equal(d.startsAt, '2026-10-23T20:00:00.000Z'); // 24 Oct 00:00 GST
    assert.equal(d.endsAt, '2026-10-31T19:59:59.000Z'); // 31 Oct 23:59:59 GST
    assert.deepEqual(d.combinesWith, { productDiscounts: true, orderDiscounts: false, shippingDiscounts: true });
  }
});

test('running it again keeps the fixed tiers and rebuilds only the catch-all', async () => {
  const shop = fakeShop();
  await createPromotion(shop, 'halloween-2026', now);
  const again = await createPromotion(shop, 'halloween-2026', now);
  assert.equal(again.filter((r) => r.skipped).length, 2);
  assert.equal(shop.deleted.length, 1);
  const live = (await shop.graphql('automaticDiscountNodes')).automaticDiscountNodes.nodes;
  assert.equal(live.length, 3);
});

test('replaces the earlier overlapping 20% discount', async () => {
  const shop = fakeShop({ existing: [{ id: 'gid://old/20', title: 'Halloween 2026 · 20% off everything' }] });
  const r = await createPromotion(shop, 'halloween-2026', now);
  assert.ok(r.some((x) => x.removed && x.title === 'Halloween 2026 · 20% off everything'));
  assert.deepEqual(shop.deleted, ['gid://old/20']);
});

test('a missing product stops before creating that tier', async () => {
  const shop = fakeShop({ products: ['og-plaayer-pack'] });
  await assert.rejects(createPromotion(shop, 'halloween-2026', now), /not found in Shopify: plaayer-pack, bar-bunch/);
  assert.equal(shop.created.length, 0);
});

test('refuses unknown or finished promotions', async () => {
  await assert.rejects(createPromotion(fakeShop(), 'nope', now), /Unknown promotion/);
  await assert.rejects(createPromotion(fakeShop(), 'halloween-2026', new Date('2026-11-02T00:00:00Z')), /already ended/);
});

test('splits a tier over 100 products and never leaves a gap', async () => {
  const many = [...CATALOG, ...Array.from({ length: 150 }, (_, i) => `p${i}`)];
  const shop = fakeShop({ products: many, existing: [{ id: 'gid://old/20', title: 'Halloween 2026 · 20% off everything else' }] });
  const order = [];
  const real = shop.graphql.bind(shop);
  shop.graphql = async (q, v) => {
    if (q.includes('discountAutomaticBasicCreate')) order.push(`create ${v.d.title}`);
    if (q.includes('discountAutomaticDelete')) order.push(`delete ${v.id}`);
    return real(q, v);
  };
  await createPromotion(shop, 'halloween-2026', now);
  const parts = shop.created.filter((c) => c.title.includes('(part'));
  assert.deepEqual(parts.map((p) => [p.title, p.input.customerGets.items.products.productsToAdd.length]), [
    ['Halloween 2026 · 20% off everything else (part 1)', 100],
    ['Halloween 2026 · 20% off everything else (part 2)', 52],
  ]);
  // The old single discount is removed only after both parts exist.
  assert.ok(order.indexOf('delete gid://old/20') > order.lastIndexOf('create Halloween 2026 · 20% off everything else (part 2)'));
});
