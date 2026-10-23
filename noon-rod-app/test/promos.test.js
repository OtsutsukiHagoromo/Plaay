import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPromotion } from '../lib/promos.js';

function fakeShop({ existing = [], products = ['og-plaayer-pack', 'plaayer-pack', 'bar-bunch', 'new-chocolate-slabs-mix-pack-of-6', 'truffle-mix'] } = {}) {
  const created = [];
  return {
    created,
    async graphql(query, vars) {
      if (query.includes('automaticDiscountNodes')) return { automaticDiscountNodes: { nodes: [...existing, ...created].map((d, i) => ({ id: `gid://d/${i}`, automaticDiscount: d })) } };
      if (query.includes('products(')) {
        const wanted = vars.q.split(' OR ').map((s) => s.replace('handle:', ''));
        return { products: { nodes: wanted.filter((h) => products.includes(h)).map((h) => ({ id: `gid://shopify/Product/${h}`, handle: h, title: h })) } };
      }
      if (query.includes('discountAutomaticBasicCreate')) {
        created.push({ title: vars.d.title, input: vars.d });
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
  assert.deepEqual(all.customerGets.items, { all: true });
  for (const d of [v, m, all]) {
    assert.equal(d.startsAt, '2026-10-23T20:00:00.000Z'); // 24 Oct 00:00 GST
    assert.equal(d.endsAt, '2026-10-31T19:59:59.000Z'); // 31 Oct 23:59:59 GST
    assert.deepEqual(d.combinesWith, { productDiscounts: true, orderDiscounts: false, shippingDiscounts: true });
  }
});

test('running it again creates nothing new', async () => {
  const shop = fakeShop();
  await createPromotion(shop, 'halloween-2026', now);
  const again = await createPromotion(shop, 'halloween-2026', now);
  assert.ok(again.every((r) => r.skipped));
  assert.equal(shop.created.length, 3);
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
