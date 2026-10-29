import assert from 'node:assert/strict';
import test from 'node:test';
import { disableFixedRates, enableFixedRates } from '../lib/express-admin.js';

const money = (amount) => ({ amount, currencyCode: 'AED' });
const cond = (operator, amount) => ({ field: 'TOTAL_PRICE', operator, conditionCriteria: money(amount) });
const zone = (id, name, provinces, rates) => ({
  zone: { id, name, countries: [{ code: { countryCode: 'AE' }, provinces: provinces.map((code) => ({ code, name: code })) }] },
  methodDefinitions: { nodes: rates },
});
const shippingFee = [
  { id: 'm1', name: 'Shipping Fee', active: true, description: null, rateProvider: { id: 'r1', price: money('15.0') }, methodConditions: [cond('GREATER_THAN_OR_EQUAL_TO', '0.0'), cond('LESS_THAN_OR_EQUAL_TO', '98.0')] },
  { id: 'm2', name: 'Shipping Fee', active: true, description: null, rateProvider: { id: 'r2', price: money('0.0') }, methodConditions: [cond('GREATER_THAN_OR_EQUAL_TO', '99.0')] },
];

function fake(zones) {
  const calls = [];
  return {
    calls,
    graphql: async (q, v) => {
      if (q.includes('deliveryProfileUpdate')) { calls.push(v); return { deliveryProfileUpdate: { profile: { id: v.id }, userErrors: [] } }; }
      return { deliveryProfiles: { nodes: [{ id: 'P1', name: 'General profile', profileLocationGroups: [{ locationGroup: { id: 'G1' }, locationGroupZones: { nodes: zones } }] }] } };
    },
  };
}

test('fixed rates: Dubai split into its own zone with the normal rates plus Express and 4-hour on AED 99+', async () => {
  const s = fake([zone('Z1', 'UAE', ['DU', 'AZ', 'SH', 'AJ', 'FU', 'RK', 'UQ'], shippingFee)]);
  const r = await enableFixedRates(s);
  assert.equal(r.created, true);
  assert.equal(s.calls.length, 1);
  const g = s.calls[0].profile.locationGroupsToUpdate[0];
  assert.equal(g.id, 'G1');
  assert.deepEqual(g.zonesToUpdate[0].countries[0].provinces.map((p) => p.code), ['AZ', 'SH', 'AJ', 'FU', 'RK', 'UQ']);
  const dubai = g.zonesToCreate[0];
  assert.deepEqual(dubai.countries, [{ code: 'AE', includeAllProvinces: false, provinces: [{ code: 'DU' }] }]);
  const m = dubai.methodDefinitionsToCreate;
  assert.deepEqual(m.map((x) => [x.name, x.rateDefinition.price.amount]), [
    ['Shipping Fee', 15], ['Shipping Fee', 0], ['Plaay Express (Dubai, within 20 km)', 0], ['Same-day delivery (Dubai, within 4 hours)', 0],
  ]);
  assert.deepEqual(m[0].priceConditionsToCreate, [
    { operator: 'GREATER_THAN_OR_EQUAL_TO', criteria: { amount: 0, currencyCode: 'AED' } },
    { operator: 'LESS_THAN_OR_EQUAL_TO', criteria: { amount: 98, currencyCode: 'AED' } },
  ]);
  assert.deepEqual(m[2].priceConditionsToCreate, [{ operator: 'GREATER_THAN_OR_EQUAL_TO', criteria: { amount: 99, currencyCode: 'AED' } }]);
});

test('fixed rates: running again changes nothing; undo puts Dubai back', async () => {
  const rates = [...shippingFee, { id: 'm3', name: 'Plaay Express (Dubai, within 20 km)', active: true, rateProvider: { price: money('0.0') }, methodConditions: [] }, { id: 'm4', name: 'Same-day delivery (Dubai, within 4 hours)', active: true, rateProvider: { price: money('0.0') }, methodConditions: [] }];
  const s = fake([zone('Z1', 'UAE', ['AZ', 'SH', 'AJ', 'FU', 'RK', 'UQ'], shippingFee), zone('Z2', 'Dubai', ['DU'], rates)]);
  assert.deepEqual(await enableFixedRates(s), { created: false, added: [] });
  assert.equal(s.calls.length, 0);
  await disableFixedRates(s);
  assert.deepEqual(s.calls[0].profile.zonesToDelete, ['Z2']);
  assert.deepEqual(s.calls[0].profile.locationGroupsToUpdate[0].zonesToUpdate[0].countries[0].provinces.map((p) => p.code).sort(), ['AJ', 'AZ', 'DU', 'FU', 'RK', 'SH', 'UQ']);
});
