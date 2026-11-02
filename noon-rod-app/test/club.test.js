import assert from 'node:assert/strict';
import test from 'node:test';
import { clubSettings, computeTiers, creditExpiry, creditFor, simulate, tierFor } from '../lib/club.js';

const s = clubSettings({});
const now = new Date('2026-11-02T12:00:00Z');
const daysAgo = (n) => new Date(now.getTime() - n * 86400e3).toISOString();

test('the Club is off unless switched on', () => {
  assert.equal(s.enabled, false);
  assert.equal(clubSettings({ CLUB_ENABLED: 'true' }).enabled, true);
});

test('tiers by 12-month spend; any active subscriber is at least Pro', () => {
  assert.equal(tierFor({ spend: 120 }, s), 'plaayer');
  assert.equal(tierFor({ spend: 500 }, s), 'pro');
  assert.equal(tierFor({ spend: 1000 }, s), 'legend');
  assert.equal(tierFor({ spend: 60, subscriber: true }, s), 'pro');
  assert.equal(tierFor({ spend: 1200, subscriber: true }, s), 'legend');
});

test('credit is a share of what was paid for products, rounded down to the fils', () => {
  assert.equal(creditFor({ subtotal: 154 }, 'plaayer', s), 7.7);
  assert.equal(creditFor({ subtotal: 154 }, 'pro', s), 10.78);
  assert.equal(creditFor({ subtotal: 154 }, 'legend', s), 15.4);
  assert.equal(creditFor({ subtotal: 99.99 }, 'pro', s), 6.99);
  assert.equal(creditExpiry('2026-11-02T00:00:00Z', s), '2027-01-01T00:00:00.000Z');
});

test('tiers from orders: only the last 12 months count; cancelled orders never count', () => {
  const orders = [
    { customerId: 'a', createdAt: daysAgo(10), total: 300 },
    { customerId: 'a', createdAt: daysAgo(200), total: 250 },
    { customerId: 'a', createdAt: daysAgo(400), total: 900 },
    { customerId: 'b', createdAt: daysAgo(5), total: 1100 },
    { customerId: 'c', createdAt: daysAgo(20), total: 80, subscription: true },
    { customerId: 'd', createdAt: daysAgo(3), total: 2000, cancelled: true },
  ];
  const t = computeTiers(orders, now, s);
  assert.equal(t.get('a').spend, 550);
  assert.equal(t.get('a').tier, 'pro');
  assert.equal(t.get('b').tier, 'legend');
  assert.equal(t.get('c').tier, 'pro');
  assert.equal(t.has('d'), false);
  const sim = simulate(orders, now, s);
  assert.deepEqual([sim.tiers.plaayer.customers, sim.tiers.pro.customers, sim.tiers.legend.customers], [0, 2, 1]);
  assert.equal(sim.maxCredit, Math.round(550 * 0.07 + 80 * 0.07 + 1100 * 0.1));
});
