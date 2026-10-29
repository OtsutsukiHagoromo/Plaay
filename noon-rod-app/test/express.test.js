import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { areaList, checkoutRates, expressSettings, locate, promise, schedule } from '../lib/express.js';
import { handleCheckoutRates, handleExpressCheck } from '../lib/handlers.js';
import { cfg } from './helpers.js';

const s = expressSettings({});
// Dubai is UTC+4: 11:00Z = 3 pm, 14:00Z = 6 pm.
const wedAfternoon = new Date('2026-11-04T11:00:00Z');
const wedEvening = new Date('2026-11-04T14:00:00Z');
const satEvening = new Date('2026-11-07T14:00:00Z');
const sunday = new Date('2026-11-08T07:00:00Z');

test('areas near the warehouse are express, the rest of Dubai 4-hour, other emirates standard', () => {
  const tier = (name) => areaList(s).find((a) => a.name === name).tier;
  assert.equal(tier('Motor City'), 'express');
  assert.equal(tier('Jumeirah Village Circle (JVC)'), 'express');
  assert.equal(tier('Dubai Marina'), 'express');
  assert.equal(tier('Downtown Dubai'), '4hr');
  assert.equal(tier('Al Qusais'), '4hr');
  assert.equal(tier('Sharjah'), 'standard');
});

test('finds the area in address text, preferring the most specific match', () => {
  assert.equal(locate({ address: 'Villa 12, Arabian Ranches 2, Dubai' }, s).name, 'Arabian Ranches 2');
  assert.equal(locate({ address: '510 New Bridge Hills 3, Uptown Motor City, Dubai' }, s).name, 'Motor City');
  assert.equal(locate({ address: 'Apt 1203, Bloom Towers, JVC' }, s).name, 'Jumeirah Village Circle (JVC)');
  assert.equal(locate({ address: 'Al Majaz 2, Sharjah' }, s).tier, 'standard');
  assert.equal(locate({ address: 'Some building, Dubai' }, s).tier, '4hr');
  assert.equal(locate({ address: 'Somewhere unknown' }, s), null);
});

test('a location pin uses distance; outside Dubai is standard', () => {
  assert.equal(locate({ lat: 25.046, lng: 55.236 }, s).tier, 'express');
  assert.equal(locate({ lat: 25.197, lng: 55.274 }, s).tier, '4hr');
  assert.equal(locate({ lat: 24.45, lng: 54.38 }, s).tier, 'standard'); // Abu Dhabi
});

test('before the cutoff it is today with a countdown; after it the next working day', () => {
  const a = schedule(wedAfternoon, s);
  assert.equal(a.when, 'today');
  assert.equal(a.secondsLeft, 2 * 3600);
  assert.equal(schedule(wedEvening, s).label, 'Tomorrow');
  assert.equal(schedule(satEvening, s).label, 'Monday');
  assert.equal(schedule(sunday, s).label, 'Tomorrow');
});

test('promise wording for each tier', () => {
  const motor = locate({ area: 'motor-city' }, s);
  assert.equal(promise(motor, wedAfternoon, s).title, 'Plaay Express · Today');
  assert.equal(promise(motor, satEvening, s).title, 'Plaay Express · Monday from 9 am');
  assert.equal(promise(locate({ area: 'downtown-dubai' }, s), wedAfternoon, s).title, '4-hour delivery · Today');
  assert.equal(promise(locate({ area: 'sharjah' }, s), wedAfternoon, s).title, 'Delivery in 1–2 working days');
  assert.equal(promise(null).tier, 'unknown');
  const paused = expressSettings({ EXPRESS_PAUSED: 'true' });
  assert.equal(promise(motor, wedAfternoon, paused).tier, 'standard');
});

const rate = (address1, city, price = 5000, qty = 1) => ({
  destination: { country: 'AE', province: city === 'Sharjah' ? 'SH' : 'DU', city, address1 },
  items: [{ price, quantity: qty }],
  currency: 'AED',
});

test('checkout rates: express area gets Express, 4-hour and Standard, fastest first', () => {
  const r = checkoutRates(rate('Uptown Motor City', 'Dubai'), wedAfternoon, s);
  assert.deepEqual(r.map((x) => x.service_code), ['plaay-express', '4hr-delivery', 'standard']);
  assert.equal(r[0].service_name, 'Plaay Express · today');
  assert.equal(r[0].total_price, '1500');
});

test('checkout rates: free over AED 99, names follow the clock, other emirates standard only', () => {
  const free = checkoutRates(rate('Downtown', 'Dubai', 5000, 2), wedAfternoon, s);
  assert.deepEqual(free.map((x) => x.service_code), ['4hr-delivery', 'standard']);
  assert.ok(free.every((x) => x.total_price === '0'));
  assert.equal(checkoutRates(rate('Motor City', 'Dubai'), satEvening, s)[0].service_name, 'Plaay Express · monday from 9 am');
  assert.deepEqual(checkoutRates(rate('Al Majaz', 'Sharjah'), wedAfternoon, s).map((x) => x.service_code), ['standard']);
});

test('checkout rate names are picked up by the dispatch app', () => {
  const [x, h] = checkoutRates(rate('Motor City', 'Dubai'), wedAfternoon, s);
  assert.match(x.service_name, cfg.expressMatch);
  assert.match(h.service_name, cfg.fourHourMatch);
  assert.doesNotMatch(h.service_name, cfg.expressMatch);
});

test('delivery check endpoint: area list and a promise, open to the storefront', async () => {
  const d = { cfg };
  const list = await handleExpressCheck(new Request('https://x/api/express?areas=1'), d);
  assert.equal(list.headers.get('access-control-allow-origin'), '*');
  const body = await list.json();
  assert.ok(body.areas.find((a) => a.id === 'motor-city'));
  const one = await (await handleExpressCheck(new Request('https://x/api/express?address=JVC%2C%20Dubai'), d)).json();
  assert.equal(one.area.id, 'jumeirah-village-circle-jvc');
});

test('checkout rates endpoint rejects unsigned requests', async () => {
  const d = { cfg };
  const raw = JSON.stringify({ rate: rate('Motor City', 'Dubai') });
  const bad = await handleCheckoutRates(new Request('https://x/api/rates', { method: 'POST', body: raw }), d);
  assert.equal(bad.status, 401);
  const sig = crypto.createHmac('sha256', 'shopify-secret').update(raw).digest('base64');
  const ok = await handleCheckoutRates(new Request('https://x/api/rates', { method: 'POST', body: raw, headers: { 'x-shopify-hmac-sha256': sig } }), d);
  assert.equal(ok.status, 200);
  assert.ok((await ok.json()).rates.length >= 1);
});
