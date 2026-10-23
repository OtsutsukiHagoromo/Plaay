// Scheduled sales: creates Shopify automatic discounts for a promotion defined here, from the
// dashboard's Promotions page. Each tier is one automatic percentage discount, and the tiers
// cover disjoint sets of products: when a product qualifies for two automatic discounts Shopify
// does not reliably pick the better one (it applied 20% to the whole cart in testing), so the
// catch-all tier lists every product except the ones in the other tiers.

export const PROMOTIONS = {
  'halloween-2026': {
    name: 'Halloween Sale 2026',
    startsAt: '2026-10-24T00:00:00+04:00',
    endsAt: '2026-10-31T23:59:59+04:00',
    tiers: [
      { title: 'Halloween 2026 · 30% off variety packs', percent: 30, handles: ['og-plaayer-pack', 'plaayer-pack', 'bar-bunch'] },
      { title: 'Halloween 2026 · 25% off mix packs', percent: 25, handles: ['new-chocolate-slabs-mix-pack-of-6', 'truffle-mix'] },
      { title: 'Halloween 2026 · 20% off everything else', percent: 20, allExcept: true, replaces: ['Halloween 2026 · 20% off everything'] },
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

async function allProducts(shopify) {
  const out = [];
  let after = null;
  do {
    const data = await shopify.graphql(
      // Only products customers can buy; drafts and archived products don't need a discount.
      `query($after: String) { products(first: 250, after: $after, query: "status:active") { nodes { id handle title } pageInfo { hasNextPage endCursor } } }`,
      { after },
    );
    out.push(...data.products.nodes);
    after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (after);
  return out;
}

async function deleteAutomatic(shopify, id) {
  const res = await shopify.graphql(
    `mutation($id: ID!) { discountAutomaticDelete(id: $id) { deletedAutomaticDiscountId userErrors { field message } } }`,
    { id },
  );
  const errors = res.discountAutomaticDelete.userErrors;
  if (errors.length) throw new Error(`delete ${id}: ${errors.map((e) => e.message).join('; ')}`);
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
  const listed = new Set(promo.tiers.flatMap((t) => t.handles || []));
  const results = [];
  for (const tier of promo.tiers) {
    const isThisTier = (d) => d.title === tier.title || d.title?.startsWith(`${tier.title} (part `);
    const current = existing.filter(isThisTier);
    if (current.length && !tier.allExcept) {
      results.push({ title: tier.title, skipped: 'already exists' });
      continue;
    }
    const products = tier.allExcept
      ? (await allProducts(shopify)).filter((p) => !listed.has(p.handle))
      : await productIdsByHandle(shopify, tier.handles);
    // Shopify allows at most 100 products per discount, so big tiers are split into parts.
    const parts = [];
    for (let i = 0; i < products.length; i += MAX_PRODUCTS) parts.push(products.slice(i, i + MAX_PRODUCTS));
    // The catch-all is rebuilt on every run so it picks up products added since. Create the new
    // parts first and only then remove the old ones, so the sale never has a gap.
    const titles = [];
    for (const [i, part] of parts.entries()) {
      const title = parts.length > 1 ? `${tier.title} (part ${i + 1})` : tier.title;
      titles.push(title);
      const id = await createTier(shopify, promo, title, tier.percent, part, current.filter((d) => d.title === title));
      results.push({ title, created: id, count: part.length });
    }
    // Then retire anything this tier replaces: earlier versions and parts no longer needed.
    const retire = existing.filter((d) => (tier.replaces || []).includes(d.title) || (isThisTier(d) && !titles.includes(d.title)));
    for (const old of retire) {
      await deleteAutomatic(shopify, old.id);
      results.push({ title: old.title, removed: true });
    }
  }
  return results;
}

const MAX_PRODUCTS = 100;

// Creates one tier part. An existing part with the same title is renamed out of the way first
// and removed once its replacement exists.
async function createTier(shopify, promo, title, percent, products, previous) {
  for (const old of previous) {
    await shopify.graphql(
      `mutation($id: ID!, $d: DiscountAutomaticBasicInput!) { discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $d) { userErrors { message } } }`,
      { id: old.id, d: { title: `${title} (replacing)` } },
    );
  }
  const id = await createDiscount(shopify, promo, title, percent, products);
  for (const old of previous) await deleteAutomatic(shopify, old.id);
  return id;
}

async function createDiscount(shopify, promo, title, percent, products) {
  const input = {
    title,
    // Starting in the past is fine; Shopify treats it as active from now.
    startsAt: new Date(promo.startsAt).toISOString(),
    endsAt: new Date(promo.endsAt).toISOString(),
    combinesWith: { productDiscounts: true, orderDiscounts: false, shippingDiscounts: true },
    customerGets: {
      value: { percentage: percent / 100 },
      items: { products: { productsToAdd: products.map((p) => p.id) } },
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
  if (errors.length) throw new Error(`${title}: ${errors.map((e) => e.message).join('; ')}`);
  return res.discountAutomaticBasicCreate.automaticDiscountNode.id;
}
