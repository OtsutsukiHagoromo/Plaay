import assert from 'node:assert/strict';
import test from 'node:test';
import { disableTest, enableTest, TEST_PROFILE } from '../lib/express-test.js';
import { checkoutRates, expressSettings } from '../lib/express.js';

function fakeShopify() {
  const state = { profiles: [], products: [] };
  const calls = [];
  return {
    state,
    calls,
    async graphql(q, v = {}) {
      calls.push(q.trim().split(/[({\s]/)[0] === 'mutation' ? q.match(/\{\s*(\w+)/)[1] : 'query');
      if (q.includes('deliveryProfiles(first: 20)')) return { deliveryProfiles: { nodes: state.profiles }, products: { nodes: state.products } };
      if (q.includes('productByIdentifier')) return { productByIdentifier: v.h === 'peanut-butter-truffles' ? { id: 'gid://shopify/Product/1', title: 'Peanut Butter Truffles' } : null };
      if (q.includes('productDuplicate')) {
        assert.match(q, /newStatus: UNLISTED/);
        const p = { id: 'gid://shopify/Product/2', title: v.title, handle: 'pbt-copy', status: 'UNLISTED', variants: { nodes: [{ id: 'gid://shopify/ProductVariant/9' }] } };
        state.products.push(p);
        return { productDuplicate: { newProduct: p, userErrors: [] } };
      }
      if (q.includes('tagsAdd')) return { tagsAdd: { userErrors: [] } };
      if (q.includes('productVariantsBulkUpdate')) { assert.equal(v.v[0].inventoryPolicy, 'CONTINUE'); return { productVariantsBulkUpdate: { userErrors: [] } }; }
      if (q.includes('publications(first')) return { publications: { nodes: [{ id: 'pub1', name: 'Online Store' }, { id: 'pub2', name: 'Shop' }] } };
      if (q.includes('publishablePublish')) { assert.deepEqual(v.in, [{ publicationId: 'pub1' }]); return { publishablePublish: { userErrors: [] } }; }
      if (q.includes('locations(first')) return { locations: { nodes: [{ id: 'loc1', isActive: true, fulfillsOnlineOrders: true }] } };
      if (q.includes('deliveryProfileCreate')) {
        state.created = v.p;
        state.profiles.push({ id: 'prof1', name: v.p.name });
        return { deliveryProfileCreate: { profile: { id: 'prof1' }, userErrors: [] } };
      }
      if (q.includes('deliveryProfileRemove')) { state.profiles = []; return { deliveryProfileRemove: { job: { id: 'j' }, userErrors: [] } }; }
      if (q.includes('productDelete')) { state.products = []; return { productDelete: { deletedProductId: v.in.id, userErrors: [] } }; }
      throw new Error(`unexpected query ${q.slice(0, 80)}`);
    },
  };
}

test('test on: a hidden copy in its own Dubai-only profile with the 2-hour Express rate only', async () => {
  const s = fakeShopify();
  const r = await enableTest(s, 'peanut-butter-truffles');
  assert.equal(r.products[0].title, 'Peanut Butter Truffles (Express test)');
  const p = s.state.created;
  assert.equal(p.name, TEST_PROFILE);
  assert.deepEqual(p.variantsToAssociate, ['gid://shopify/ProductVariant/9']);
  const zone = p.locationGroupsToCreate[0].zonesToCreate[0];
  assert.deepEqual(zone.countries, [{ code: 'AE', includeAllProvinces: false, provinces: [{ code: 'DU' }] }]);
  assert.deepEqual([...new Set(zone.methodDefinitionsToCreate.map((m) => m.name))], ['Plaay Express (Dubai, 2-hour delivery)']);
  assert.deepEqual(zone.methodDefinitionsToCreate.map((m) => m.rateDefinition.price.amount), [0, 15]);
  // Running it again changes nothing.
  const again = await enableTest(s, 'peanut-butter-truffles');
  assert.equal(again.already, true);
});

test('test off removes the profile and the copy; unknown handles are refused', async () => {
  const s = fakeShopify();
  await enableTest(s, 'peanut-butter-truffles');
  const r = await disableTest(s);
  assert.equal(r.removedProfile, true);
  assert.equal(s.state.products.length, 0);
  await assert.rejects(enableTest(fakeShopify(), 'nope'), /No product/);
});

test('4-hour is off unless FOUR_HOUR_ENABLED', async () => {
  assert.equal(expressSettings({}).fourHour, false);
  assert.equal(expressSettings({ FOUR_HOUR_ENABLED: 'true' }).fourHour, true);
  const s = { ...expressSettings({}), checkout: 'on' };
  const geo = { drivingKm: async () => 8, searchAddress: async () => [], reverseAddress: async () => null, geocode: async () => null };
  const rate = { currency: 'AED', destination: { country: 'AE', province: 'DU', city: 'Dubai', address1: 'Al Barsha 1', latitude: 25.11, longitude: 55.2 }, items: [{ price: 12000, quantity: 1, properties: {} }] };
  const rates = await checkoutRates(rate, new Date('2026-11-11T08:00:00Z'), s, geo);
  assert.ok(rates.length >= 1);
  assert.ok(rates.every((r) => r.service_code !== '4hr-delivery'));
});
