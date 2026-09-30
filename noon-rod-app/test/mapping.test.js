import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTaskPayload, isExpressOrder, MappingError, normalizePhone, toE7, toFils } from '../lib/mapping.js';
import { cfg, makeOrder } from './helpers.js';

test('unit conversions', () => {
  assert.equal(toE7(25.1234567), 251234567);
  assert.equal(toE7('-0.5'), -5000000);
  assert.equal(toFils('125.50'), 12550);
  assert.equal(toFils('0.29'), 29); // no float drift
});

test('normalizePhone handles common UAE formats', () => {
  assert.equal(normalizePhone('050 123 4567'), '+971501234567');
  assert.equal(normalizePhone('+971 50-123-4567'), '+971501234567');
  assert.equal(normalizePhone('00971501234567'), '+971501234567');
  assert.equal(normalizePhone('971501234567'), '+971501234567');
  assert.equal(normalizePhone('501234567'), '+971501234567');
  assert.equal(normalizePhone('04 123 4567'), '+97141234567');
  assert.equal(normalizePhone('abc'), '');
  assert.equal(normalizePhone(null), '');
});

test('isExpressOrder matches the shipping line', () => {
  assert.equal(isExpressOrder(makeOrder(), cfg), true);
  assert.equal(isExpressOrder(makeOrder({ shippingLine: { title: 'Standard', code: 'std' } }), cfg), false);
  assert.equal(isExpressOrder(makeOrder({ shippingLine: null }), cfg), false);
});

test('prepaid order maps to a noon payload', () => {
  const p = buildTaskPayload(makeOrder(), cfg);
  assert.deepEqual(p, {
    order_reference: '#1234',
    outlet_code: 'PLAAYWH01',
    drop_off_address: {
      lat: 250877000,
      lng: 551477000,
      address: 'Apt 1204, Marina Gate 2, Dubai Marina, Dubai, Dubai',
      contact_name: 'Aisha Khan',
      contact_phone_number: '+971501234567',
      country_code: 'ae',
      city: 'Dubai',
    },
    package_count: 1,
    pickup_notes: 'Plaay order #1234 (3 items)',
    prepaid_value: 12550,
    delivery_notes: 'Please call on arrival',
  });
});

test('cash on delivery sends only cod_value, for the outstanding amount', () => {
  const p = buildTaskPayload(
    makeOrder({
      paymentGatewayNames: ['Cash on Delivery (COD)'],
      displayFinancialStatus: 'PENDING',
      totalOutstandingSet: { shopMoney: { amount: '125.50', currencyCode: 'AED' } },
    }),
    cfg,
  );
  assert.equal(p.cod_value, 12550);
  assert.equal('prepaid_value' in p, false);
});

test('a paid COD-gateway order is treated as prepaid', () => {
  const p = buildTaskPayload(makeOrder({ paymentGatewayNames: ['Cash on Delivery (COD)'] }), cfg);
  assert.equal(p.prepaid_value, 12550);
  assert.equal('cod_value' in p, false);
});

test('falls back to order and billing phone', () => {
  const base = makeOrder();
  const p = buildTaskPayload({ ...base, shippingAddress: { ...base.shippingAddress, phone: null }, phone: '+971 55 000 1111' }, cfg);
  assert.equal(p.drop_off_address.contact_phone_number, '+971550001111');
});

test('long notes are trimmed to noon limits', () => {
  const p = buildTaskPayload(makeOrder({ note: 'x'.repeat(400) }), cfg);
  assert.equal(p.delivery_notes.length, 250);
});

test('reports every problem at once', () => {
  const base = makeOrder();
  assert.throws(
    () =>
      buildTaskPayload(
        { ...base, shippingAddress: { ...base.shippingAddress, latitude: null, phone: 'n/a', countryCodeV2: 'IN' } },
        cfg,
      ),
    (err) => {
      assert.ok(err instanceof MappingError);
      assert.equal(err.problems.length, 3);
      assert.match(err.message, /AE\/SA/);
      assert.match(err.message, /map coordinates/);
      assert.match(err.message, /phone/);
      return true;
    },
  );
});

test('missing outlet code or address is rejected', () => {
  assert.throws(() => buildTaskPayload(makeOrder({ shippingAddress: null }), cfg), /no shipping address/);
  const noOutlet = { ...cfg, noon: { ...cfg.noon, outletCode: '' } };
  assert.throws(() => buildTaskPayload(makeOrder(), noOutlet), /NOON_OUTLET_CODE/);
});
