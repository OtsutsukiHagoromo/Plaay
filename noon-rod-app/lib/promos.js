// Scheduled sales: creates Shopify automatic discounts for a promotion defined here, from the
// dashboard's Promotions page. Each tier is one automatic percentage discount. All tiers combine
// with each other as product discounts, so Shopify gives every line its single best tier.

export const PROMOTIONS = {
  'halloween-2026': {
    name: 'Halloween Sale 2026',
    startsAt: '2026-10-24T00:00:00+04:00',
    endsAt: '2026-10-31T23:59:59+04:00',
    tiers: [
      { title: 'Halloween 2026 · 30% off variety packs', percent: 30, handles: ['og-plaayer-pack', 'plaayer-pack', 'bar-bunch'] },
      { title: 'Halloween 2026 · 25% off mix packs', percent: 25, handles: ['new-chocolate-slabs-mix-pack-of-6', 'truffle-mix'] },
      { title: 'Halloween 2026 · 20% off everything', percent: 20, all: true },
    ],
  },
};

const DISCOUNT_FIELDS = `
  __typename
  ... on DiscountAutomaticBasic { title status startsAt endsAt combinesWith { productDiscounts orderDiscounts shippingDiscounts } }
  ... on DiscountAutomaticBxgy { title status startsAt endsAt }
  ... on DiscountAutomaticFreeShipping { title status startsAt endsAt }
  ... on DiscountAutomaticApp { title status startsAt endsAt }
`;

export async function listAutomaticDiscounts(shopify) {
  const data = await shopify.graphql(`{
    automaticDiscountNodes(first: 100, reverse: true) { nodes { id automaticDiscount { ${DISCOUNT_FIELDS} } } }
  }`);
  return data.automaticDiscountNodes.nodes.map((n) => ({ id: n.id, ...n.automaticDiscount }));
}

async function productIdsByHandle(shopify, handles) {
  const data = await shopify.graphql(
    `query($q: String!) { products(first: 50, query: $q) { nodes { id handle title } } }`,
    { q: handles.map((h) => `handle:${h}`).join(' OR ') },
  );
  const byHandle = Object.fromEntries(data.products.nodes.map((p) => [p.handle, p]));
  const missing = handles.filter((h) => !byHandle[h]);
  if (missing.length) throw new Error(`Products not found in Shopify: ${missing.join(', ')}`);
  return handles.map((h) => byHandle[h]);
}

// Creates any tier that doesn't exist yet (matched by title), so it is safe to run twice.
export async function createPromotion(shopify, key, now = new Date()) {
  const promo = PROMOTIONS[key];
  if (!promo) throw new Error(`Unknown promotion ${key}`);
  if (new Date(promo.endsAt) <= now) throw new Error(`${promo.name} has already ended`);

  const existing = await listAutomaticDiscounts(shopify);
  const results = [];
  for (const tier of promo.tiers) {
    if (existing.some((d) => d.title === tier.title)) {
      results.push({ title: tier.title, skipped: 'already exists' });
      continue;
    }
    const products = tier.all ? null : await productIdsByHandle(shopify, tier.handles);
    const input = {
      title: tier.title,
      // Starting in the past is fine; Shopify treats it as active from now.
      startsAt: new Date(promo.startsAt).toISOString(),
      endsAt: new Date(promo.endsAt).toISOString(),
      combinesWith: { productDiscounts: true, orderDiscounts: false, shippingDiscounts: true },
      customerGets: {
        value: { percentage: tier.percent / 100 },
        items: tier.all ? { all: true } : { products: { productsToAdd: products.map((p) => p.id) } },
      },
    };
    const res = await shopify.graphql(
      `mutation($d: DiscountAutomaticBasicInput!) {
        discountAutomaticBasicCreate(automaticBasicDiscount: $d) {
          automaticDiscountNode { id }
          userErrors { field message code }
        }
      }`,
      { d: input },
    );
    const errors = res.discountAutomaticBasicCreate.userErrors;
    if (errors.length) throw new Error(`${tier.title}: ${errors.map((e) => e.message).join('; ')}`);
    results.push({ title: tier.title, created: res.discountAutomaticBasicCreate.automaticDiscountNode.id, products: products?.map((p) => p.title) || 'all products' });
  }
  return results;
}
