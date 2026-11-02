// Plaayers Club: tiers from 12-month spend, credit back on every paid order.
// OFF unless CLUB_ENABLED=true: nothing here writes to Shopify while it's off. The dashboard's
// Club page uses the pure functions to show what the Club would look like on real orders.
//
//   Plaayer  any customer with an account          5% back
//   Pro      AED 500+ in 12 months, or a subscriber  7% back, free Express
//   Legend   AED 1,000+ in 12 months                10% back, free Express
//
// Credit is Shopify store credit (added on paid orders, expires after CLUB_CREDIT_DAYS). The tier,
// balance and spend are also saved on the customer (metafields plaay_club.*) for the theme.

export function clubSettings(env = process.env) {
  return {
    enabled: /^(1|true|yes)$/i.test(env.CLUB_ENABLED || ''),
    rates: { plaayer: Number(env.CLUB_RATE_PLAAYER || 5), pro: Number(env.CLUB_RATE_PRO || 7), legend: Number(env.CLUB_RATE_LEGEND || 10) },
    proSpend: Number(env.CLUB_PRO_SPEND_AED || 500),
    legendSpend: Number(env.CLUB_LEGEND_SPEND_AED || 1000),
    creditDays: Number(env.CLUB_CREDIT_DAYS || 60),
    welcomeCredit: Number(env.CLUB_WELCOME_AED || 25),
  };
}

export const TIER_NAMES = { plaayer: 'Plaayer', pro: 'Pro', legend: 'Legend' };

export function tierFor({ spend = 0, subscriber = false }, s = clubSettings()) {
  if (spend >= s.legendSpend) return 'legend';
  if (spend >= s.proSpend || subscriber) return 'pro';
  return 'plaayer';
}

// Credit for one order, in AED with 2 decimals: on what the customer paid for products
// (after discounts, without delivery).
export function creditFor(order, tier, s = clubSettings()) {
  const products = Math.max(0, Number(order.subtotal ?? order.total ?? 0));
  return Math.floor(products * s.rates[tier]) / 100;
}

export function creditExpiry(paidAt, s = clubSettings()) {
  return new Date(new Date(paidAt).getTime() + s.creditDays * 86400e3).toISOString();
}

// Orders -> each customer's 12-month spend, subscriber flag and tier.
// orders: [{ customerId, createdAt, total (AED), subscription (bool), cancelled (bool) }]
export function computeTiers(orders, now = new Date(), s = clubSettings()) {
  const since = now.getTime() - 365 * 86400e3;
  const subSince = now.getTime() - 45 * 86400e3; // a renewal in the last 45 days = active subscriber
  const by = new Map();
  for (const o of orders) {
    if (!o.customerId || o.cancelled) continue;
    const t = new Date(o.createdAt).getTime();
    const c = by.get(o.customerId) || { spend: 0, subscriber: false, orders12m: 0 };
    if (t >= since) { c.spend += Number(o.total) || 0; c.orders12m += 1; }
    if (o.subscription && t >= subSince) c.subscriber = true;
    by.set(o.customerId, c);
  }
  for (const c of by.values()) c.tier = tierFor(c, s);
  return by;
}

// What the Club would look like today: members per tier, their share of 12-month revenue, and
// the most credit it could cost in a year (every member, every dirham spent).
export function simulate(orders, now = new Date(), s = clubSettings()) {
  const tiers = computeTiers(orders, now, s);
  const out = { plaayer: { customers: 0, revenue: 0 }, pro: { customers: 0, revenue: 0 }, legend: { customers: 0, revenue: 0 } };
  let maxCredit = 0;
  let revenue = 0;
  for (const c of tiers.values()) {
    if (!c.orders12m) continue;
    out[c.tier].customers += 1;
    out[c.tier].revenue += c.spend;
    revenue += c.spend;
    maxCredit += (c.spend * s.rates[c.tier]) / 100;
  }
  return { tiers: out, revenue, maxCredit: Math.round(maxCredit), subscribers: [...tiers.values()].filter((c) => c.subscriber).length };
}

// ---- Shopify writes (only used when the Club is enabled) ----

export async function addCredit(shopify, customerId, amount, expiresAt, currencyCode = 'AED') {
  if (!(amount > 0)) return null;
  const r = await shopify.graphql(
    `mutation($id: ID!, $input: StoreCreditAccountCreditInput!) { storeCreditAccountCredit(id: $id, creditInput: $input) {
      storeCreditAccountTransaction { amount { amount } account { balance { amount } } } userErrors { field message } } }`,
    { id: customerId, input: { creditAmount: { amount: amount.toFixed(2), currencyCode }, expiresAt } },
  );
  const e = r.storeCreditAccountCredit.userErrors;
  if (e.length) throw new Error(e.map((x) => x.message).join('; '));
  return r.storeCreditAccountCredit.storeCreditAccountTransaction;
}

// Save tier, balance and spend on the customer for the theme (values in fils, like the theme).
export async function saveClubFields(shopify, customerId, { tier, creditAed, spendAed }) {
  const f = (key, value) => ({ ownerId: customerId, namespace: 'plaay_club', key, type: 'single_line_text_field', value: String(value) });
  const r = await shopify.graphql(
    'mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }',
    { m: [f('tier', tier), f('credit', Math.round(creditAed * 100)), f('spend_12m', Math.round(spendAed * 100))] },
  );
  const e = r.metafieldsSet.userErrors;
  if (e.length) throw new Error(e.map((x) => x.message).join('; '));
}
