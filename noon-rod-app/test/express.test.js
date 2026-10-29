import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { areaList, checkoutRates, expressSettings, locate, promise, schedule } from '../lib/express.js';
import { handleCheckoutRates, handleExpressCheck } from '../lib/handlers.js';
import { hasSubscription, isExpressOrder, websitePin, buildTaskPayload } from '../lib/mapping.js';
import { cfg, makeOrder } from './helpers.js';

const s = expressSettings({});
const on = expressSettings({ EXPRESS_CHECKOUT: 'on' });
// Dubai is UTC+4: 11:00Z = 3 pm, 14:00Z = 6 pm.
const wedAfternoon = new Date('2026-11-04T11:00:00Z');
const wedEvening = new Date('2026-11-04T14:00:00Z');
const satEvening = new Date('2026-11-07T14:00:00Z');
const sunday = new Date('2026-11-08T07:00:00Z');

// Offline stand-in for OSRM / Photon.
const geo = (km = 12, pin = null) => ({
  drivingKm: async () => km,
  geocode: async () => pin,
  searchAddress: async () => [{ label: 'Bloom Towers, Dana Road, Al Barsha South 4', address1: 'Bloom Towers, Dana Road', community: 'Al Barsha South 4', emirate: 'Dubai', lat: 25.067, lng: 55.2036 }],
  reverseAddress: async (lat, lng) => ({ label: 'Jumana Road, Al Barsha South 4', address1: 'Jumana Road', community: 'Al Barsha South 4', emirate: 'Dubai', lat: +lat, lng: +lng }),
});

test('measured areas: near the warehouse Express, the rest of Dubai 4-hour, other emirates standard', () => {
  const area = (name) => areaList(s).find((a) => a.name === name);
  assert.equal(area('Motor City').tier, 'express');
  assert.equal(area('Dubai Marina').tier, 'express');
  assert.equal(area('Dubai Marina').edge, true);
  assert.equal(area('Downtown Dubai').tier, '4hr');
  assert.equal(area('Sharjah').tier, 'standard');
});

test('address text: the most specific known area wins; unknown text is looked up', async () => {
  assert.equal((await locate({ address: 'Villa 12, Arabian Ranches 2, Dubai' }, s, geo())).name, 'Arabian Ranches 2');
  assert.equal((await locate({ address: 'Bloom Towers, Al Barsha South 4, Dubai' }, s, geo())).name, 'Jumeirah Village Circle (JVC)');
  assert.equal((await locate({ address: 'Al Majaz 2, Sharjah' }, s, geo())).tier, 'standard');
  const found = await locate({ address: 'Some Tower, Dubai' }, s, geo(25, { lat: 25.2, lng: 55.27 }));
  assert.equal(found.tier, '4hr');
  assert.equal((await locate({ address: 'Somewhere, Dubai' }, s, geo())).tier, '4hr');
  assert.equal(await locate({ address: 'Somewhere unknown' }, s, geo()), null);
});

test('a pin is measured by road; the router failing falls back to the nearest area', async () => {
  assert.equal((await locate({ lat: 25.046, lng: 55.236 }, s, geo(16.6))).tier, 'express');
  assert.equal((await locate({ lat: 25.046, lng: 55.236 }, s, geo(21))).tier, '4hr');
  const fallback = await locate({ lat: 25.046, lng: 55.236 }, s, geo(null));
  assert.equal(fallback.name, 'Motor City');
  assert.equal(fallback.tier, 'express');
  assert.equal((await locate({ lat: 24.45, lng: 54.38 }, s, geo())).tier, 'standard'); // Abu Dhabi
});

test('before the cutoff it is today with a countdown; after it the next working day', () => {
  const a = schedule(wedAfternoon, s);
  assert.equal(a.when, 'today');
  assert.equal(a.secondsLeft, 2 * 3600);
  assert.equal(schedule(wedEvening, s).label, 'Tomorrow');
  assert.equal(schedule(satEvening, s).label, 'Monday');
  assert.equal(schedule(sunday, s).label, 'Tomorrow');
});

test('promise wording; pausing turns Express off', async () => {
  const motor = await locate({ area: 'motor-city' }, s, geo());
  assert.equal(promise(motor, wedAfternoon, s).title, 'Plaay Express · Today');
  assert.equal(promise(motor, satEvening, s).title, 'Plaay Express · Monday from 9 am');
  assert.equal(promise(await locate({ area: 'downtown-dubai' }, s, geo()), wedAfternoon, s).title, '4-hour delivery · Today');
  assert.equal(promise(await locate({ area: 'sharjah' }, s, geo()), wedAfternoon, s).title, 'Delivery in 1–2 working days');
  assert.equal(promise(null).tier, 'unknown');
  assert.equal(promise(motor, wedAfternoon, { ...s, paused: true }).tier, 'standard');
});

const rate = (address1, city, { price = 5000, qty = 1, props = { _plx: '1' } } = {}) => ({
  destination: { country: 'AE', province: city === 'Sharjah' ? 'SH' : 'DU', city, address1 },
  items: [{ price, quantity: qty, properties: props }],
  currency: 'AED',
});

test('checkout: Express then 4-hour (standard stays the store rate), phone required', async () => {
  const r = await checkoutRates(rate('Uptown Motor City', 'Dubai'), wedAfternoon, on, geo());
  assert.deepEqual(r.map((x) => x.service_code), ['plaay-express', '4hr-delivery']);
  assert.equal(r[0].service_name, 'Plaay Express · today');
  assert.equal(r[0].total_price, '1500');
  assert.ok(r.every((x) => x.phone_required));
});

test('checkout: free over AED 99, names follow the clock, other emirates get nothing extra', async () => {
  const free = await checkoutRates(rate('Downtown', 'Dubai', { qty: 2 }), wedAfternoon, on, geo());
  assert.deepEqual(free.map((x) => x.service_code), ['4hr-delivery']);
  assert.equal(free[0].total_price, '0');
  assert.equal((await checkoutRates(rate('Motor City', 'Dubai'), satEvening, on, geo()))[0].service_name, 'Plaay Express · monday from 9 am');
  assert.deepEqual(await checkoutRates(rate('Al Majaz', 'Sharjah'), wedAfternoon, on, geo()), []);
});

test('checkout: no Express with Subscribe & Save, when paused, off, or (preview) for other bags', async () => {
  assert.deepEqual(await checkoutRates(rate('Motor City', 'Dubai', { props: { _plx: '1', _plx_sub: '1' } }), wedAfternoon, on, geo()), []);
  assert.deepEqual(await checkoutRates(rate('Motor City', 'Dubai'), wedAfternoon, { ...on, paused: true }, geo()), []);
  assert.deepEqual(await checkoutRates(rate('Motor City', 'Dubai'), wedAfternoon, { ...on, checkout: 'off' }, geo()), []);
  assert.deepEqual(await checkoutRates(rate('Motor City', 'Dubai', { props: null }), wedAfternoon, s, geo()), []);
  assert.equal((await checkoutRates(rate('Motor City', 'Dubai'), wedAfternoon, s, geo())).length, 2);
});

test('checkout rate names are picked up by the dispatch app', async () => {
  const [x, h] = await checkoutRates(rate('Motor City', 'Dubai'), wedAfternoon, on, geo());
  assert.match(x.service_name, cfg.expressMatch);
  assert.match(h.service_name, cfg.fourHourMatch);
  assert.doesNotMatch(h.service_name, cfg.expressMatch);
});

test('subscription orders are never treated as Express', () => {
  const o = makeOrder({ shippingLine: { title: 'Plaay Express · today', code: 'plaay-express' } });
  assert.equal(isExpressOrder(o, cfg), true);
  const sub = makeOrder({ shippingLine: o.shippingLine, lineItems: { nodes: [{ title: 'Truffles', quantity: 1, sellingPlan: { name: 'Every 4 weeks' } }] } });
  assert.equal(hasSubscription(sub), true);
  assert.equal(isExpressOrder(sub, cfg), false);
});

test('the website pin fills in a missing map pin when the address is in the same area', () => {
  const base = makeOrder();
  const noPin = { ...base.shippingAddress, latitude: null, longitude: null, address1: 'Bloom Towers', city: 'Jumeirah Village Circle (JVC)' };
  const attrs = [{ key: '_plx_pin', value: '25.067,55.2036' }, { key: 'Delivery area', value: 'Jumeirah Village Circle (JVC)' }];
  const o = makeOrder({ shippingAddress: noPin, customAttributes: attrs });
  assert.deepEqual(websitePin(o), { latitude: 25.067, longitude: 55.2036 });
  assert.equal(buildTaskPayload(o, cfg).drop_off_address.lat, 250670000);
  const elsewhere = makeOrder({ shippingAddress: { ...noPin, address1: 'Gift, Business Bay', city: 'Dubai' }, customAttributes: attrs });
  assert.equal(websitePin(elsewhere), null);
});

test('delivery check endpoint: areas, suggestions, a pin with its address', async () => {
  const d = { cfg, geo: geo(14) };
  const list = await handleExpressCheck(new Request('https://x/api/express?areas=1'), d);
  assert.equal(list.headers.get('access-control-allow-origin'), '*');
  assert.ok((await list.json()).areas.find((a) => a.id === 'motor-city'));
  const sug = await (await handleExpressCheck(new Request('https://x/api/express?q=bloom'), d)).json();
  assert.equal(sug.results[0].kind, 'address');
  assert.equal(sug.results[0].area, 'Jumeirah Village Circle (JVC)');
  const pin = await (await handleExpressCheck(new Request('https://x/api/express?lat=25.058&lng=55.209&reverse=1'), d)).json();
  assert.equal(pin.tier, 'express');
  assert.equal(pin.address.address1, 'Jumana Road');
});

test('checkout rates endpoint rejects unsigned requests', async () => {
  const d = { cfg, geo: geo(), log: { info() {} } };
  const raw = JSON.stringify({ rate: rate('Motor City', 'Dubai') });
  const bad = await handleCheckoutRates(new Request('https://x/api/rates', { method: 'POST', body: raw }), d);
  assert.equal(bad.status, 401);
  const sig = crypto.createHmac('sha256', 'shopify-secret').update(raw).digest('base64');
  const ok = await handleCheckoutRates(new Request('https://x/api/rates', { method: 'POST', body: raw, headers: { 'x-shopify-hmac-sha256': sig } }), d);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).rates.length, 2);
});
