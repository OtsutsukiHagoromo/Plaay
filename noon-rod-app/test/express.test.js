import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { areaList, checkoutRates, expressSettings, locate, promise, schedule } from '../lib/express.js';
import { handleCheckoutRates, handleExpressCheck } from '../lib/handlers.js';
import { hasSubscription, isExpressOrder, websitePin, buildTaskPayload } from '../lib/mapping.js';
import { cfg, makeOrder } from './helpers.js';

const s = { ...expressSettings({ FOUR_HOUR_ENABLED: 'true' }), previewProducts: ['9100000000001'] }; // 4-hour paths; see the 4-hour-off test below
const off4 = { ...expressSettings({}), previewProducts: ['9100000000001'] };
const on = expressSettings({ EXPRESS_CHECKOUT: 'on', FOUR_HOUR_ENABLED: 'true' });
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

const TEST_ID = '9100000000001'; // the hidden test product
const rate = (address1, city, { price = 5000, qty = 1, props = { _plx: '1' }, pid = TEST_ID } = {}) => ({
  destination: { country: 'AE', province: city === 'Sharjah' ? 'SH' : 'DU', city, address1 },
  items: [{ price, quantity: qty, properties: props, product_id: Number(pid) }],
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
  // Preview: a bag without the hidden test product gets nothing, even with the website's marker.
  assert.deepEqual(await checkoutRates(rate('Motor City', 'Dubai', { pid: '123' }), wedAfternoon, s, geo()), []);
  assert.deepEqual(await checkoutRates(rate('Motor City', 'Dubai'), wedAfternoon, { ...s, previewProducts: [] }, geo()), []);
  assert.equal((await checkoutRates(rate('Motor City', 'Dubai'), wedAfternoon, s, geo())).length, 2);
  assert.equal((await checkoutRates(rate('Motor City', 'Dubai'), wedAfternoon, off4, geo())).length, 1); // 4-hour off: Express only
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
  // Shopify knows the hidden test product; checkout mode stays preview.
  const shopify = { graphql: async (q) => (q.includes('tag:express-test')
    ? { deliveryProfiles: { nodes: [] }, products: { nodes: [{ id: `gid://shopify/Product/${TEST_ID}`, title: 't', handle: 't', status: 'UNLISTED', variants: { nodes: [] } }] } }
    : { shop: {} }) };
  const d = { cfg: { ...cfg, express: { ...cfg.express, checkout: 'preview' } }, shopify, geo: geo(), log: { info() {} } };
  const raw = JSON.stringify({ rate: rate('Motor City', 'Dubai') });
  const bad = await handleCheckoutRates(new Request('https://x/api/rates', { method: 'POST', body: raw }), d);
  assert.equal(bad.status, 401);
  const sig = crypto.createHmac('sha256', 'shopify-secret').update(raw).digest('base64');
  const ok = await handleCheckoutRates(new Request('https://x/api/rates', { method: 'POST', body: raw, headers: { 'x-shopify-hmac-sha256': sig } }), d);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).rates.length, 2);
});

test('4-hour off (live for now): beyond the Express limit is normal 1–2 day delivery', async () => {
  const far = areaList(off4).find((a) => a.km != null && a.km > off4.expressMaxKm);
  const near = areaList(off4).find((a) => a.km != null && a.km <= off4.expressMaxKm);
  assert.equal(far.tier, 'standard');
  assert.equal(near.tier, 'express');
  const p = promise({ id: far.id, name: far.name, tier: '4hr', km: 26 }, wedAfternoon, off4);
  assert.equal(p.tier, 'standard');
  assert.match(p.detail, /doesn’t reach this address yet/);
  assert.equal(await locate({ address: 'Somewhere, Dubai' }, off4, { geocode: async () => null, drivingKm: async () => null }), null);
});

test('after midnight on a working day Express is today from the opening hour, not within 2 hours', async () => {
  const monEarly = new Date('2026-11-15T20:13:00Z'); // Mon 16 Nov, 00:13 in Dubai
  const p = promise({ id: 'motor-city', name: 'Motor City', tier: 'express', km: 16.6 }, monEarly, off4);
  assert.equal(p.title, 'Plaay Express · Today from 9 am');
  assert.doesNotMatch(p.detail, /within 2 hours/);
  const noon = promise({ id: 'motor-city', name: 'Motor City', tier: 'express', km: 16.6 }, new Date('2026-11-16T08:00:00Z'), off4);
  assert.equal(noon.title, 'Plaay Express · Today');
  const [x] = await checkoutRates(rate('Motor City', 'Dubai'), monEarly, { ...off4, checkout: 'on' }, geo());
  assert.equal(x.service_name, 'Plaay Express · today from 9 am');
});

test('holidays: no Express run that day; the next working day is promised', () => {
  const hol = { ...off4, holidays: ['2026-12-02', '2026-12-03'] };
  const tueEve = new Date('2026-12-01T14:00:00Z'); // Tue 1 Dec, 6 pm Dubai
  const sch = schedule(tueEve, hol);
  assert.equal(sch.label, 'Friday'); // Wed 2 and Thu 3 are holidays
  const wedNoon = new Date('2026-12-02T08:00:00Z');
  assert.notEqual(schedule(wedNoon, hol).when, 'today');
  assert.equal(schedule(wedNoon, off4).when, 'today');
});

test('checkout uses the website pin when the typed address is the same place, else the typed text', async () => {
  const sOn = { ...off4, checkout: 'on' };
  // Typed "Dubai Marina" (area centre 18.7 km, Express) but the pin is past the limit by road.
  const pinFar = '25.0870,55.1460';
  const byKm = (pinKm) => ({ ...geo(), drivingKm: async (_w, p) => (Math.abs(p.lat - 25.087) < 0.001 ? pinKm : 18.7), geocode: async () => null });
  const withPin = { ...rate('Dubai Marina', 'Dubai'), items: [{ price: 12000, quantity: 1, product_id: 9100000000001, properties: { _plx: '1', _plx_pin: pinFar } }] };
  assert.deepEqual(await checkoutRates(withPin, wedAfternoon, sOn, byKm(21.4)), []);
  // Same pin, but it is inside the limit: Express.
  assert.equal((await checkoutRates(withPin, wedAfternoon, sOn, byKm(19.2)))[0].service_code, 'plaay-express');
  // No pin at all (e.g. Apple Pay): the typed text decides, Express still offered in range.
  const noPin = rate('Dubai Marina', 'Dubai', { price: 12000 });
  assert.equal((await checkoutRates(noPin, wedAfternoon, sOn, byKm(21.4)))[0].service_code, 'plaay-express');
  // A pin from a different place (Deira typed, Motor City pinned): the typed address is judged.
  const other = { ...rate('Deira City Centre', 'Dubai'), items: [{ price: 12000, quantity: 1, product_id: 9100000000001, properties: { _plx: '1', _plx_pin: '25.0450,55.2380' } }] };
  const deira = { ...geo(), geocode: async () => ({ lat: 25.2526, lng: 55.3309 }), drivingKm: async (_w, p) => (p.lat > 25.2 ? 34 : 16) };
  assert.deepEqual(await checkoutRates(other, wedAfternoon, sOn, deira), []);
});

test('free Express is judged after discount codes, like Standard delivery', async () => {
  const sOn = { ...off4, checkout: 'on' };
  const bag = rate('Motor City', 'Dubai', { price: 6000, qty: 2 }); // AED 120 before discounts
  assert.equal((await checkoutRates(bag, wedAfternoon, sOn, geo()))[0].total_price, '0');
  // PLAAYNOW takes AED 30 off: AED 90 left, under AED 99, so AED 15.
  // The shape Shopify sends (seen in the live log): total_price is already after the discount.
  const coded = { ...bag, order_totals: { subtotal_price: 12000, total_price: 9000, discount_amount: 3000 } };
  assert.equal((await checkoutRates(coded, wedAfternoon, sOn, geo()))[0].total_price, '1500');
  // A small discount that keeps it over AED 99: still free.
  const small = { ...bag, order_totals: { subtotal_price: 12000, total_price: 10500, discount_amount: 1500 } }; // AED 105 left
  assert.equal((await checkoutRates(small, wedAfternoon, sOn, geo()))[0].total_price, '0');
});
