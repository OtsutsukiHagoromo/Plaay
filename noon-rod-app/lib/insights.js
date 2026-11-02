// Order history export for retention analysis, via a Shopify bulk operation (no time limit).
// Anonymous: customer ids only, no names, emails, phones or street addresses.

const QUERY = `{
  orders(query: "created_at:>=2024-11-01") {
    edges { node {
      id createdAt sourceName cancelledAt displayFinancialStatus
      customer { id }
      totalPriceSet { shopMoney { amount } }
      subtotalPriceSet { shopMoney { amount } }
      totalDiscountsSet { shopMoney { amount } }
      discountCodes
      shippingAddress { city provinceCode }
      shippingLine { title }
      lineItems { edges { node { title quantity sellingPlan { name } product { handle productType } } } }
    } }
  }
}`;

export async function startExport(shopify) {
  const r = await shopify.graphql(
    'mutation($q: String!) { bulkOperationRunQuery(query: $q) { bulkOperation { id status } userErrors { field message } } }',
    { q: QUERY },
  );
  const e = r.bulkOperationRunQuery.userErrors;
  if (e.length) throw new Error(e.map((x) => x.message).join('; '));
  return r.bulkOperationRunQuery.bulkOperation;
}

export async function exportStatus(shopify) {
  const r = await shopify.graphql('{ currentBulkOperation(type: QUERY) { id status errorCode objectCount createdAt completedAt url } }');
  return r.currentBulkOperation;
}

// Customer counts for context (marketing consent, accounts).
export async function customerCounts(shopify) {
  const q = async (query) => (await shopify.graphql('query($q: String) { customersCount(query: $q) { count precision } }', { q: query })).customersCount;
  return {
    all: await q(null),
    emailSubscribed: await q('email_subscription_status:SUBSCRIBED'),
    withOrders: await q('orders_count:>0'),
    repeat: await q('orders_count:>1'),
  };
}

// The latest export's orders in the shape lib/club.js reads (or null if there is no export).
export async function exportedOrders(shopify, fetchImpl = globalThis.fetch) {
  const st = await exportStatus(shopify);
  if (!st?.url) return null;
  const text = await (await fetchImpl(st.url)).text();
  const orders = new Map();
  const subs = new Set();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const o = JSON.parse(line);
    if (o.__parentId) { if (o.sellingPlan) subs.add(o.__parentId); continue; }
    if (!o.createdAt) continue;
    orders.set(o.id, {
      id: o.id,
      customerId: o.customer?.id || null,
      createdAt: o.createdAt,
      total: Number(o.totalPriceSet?.shopMoney?.amount || 0),
      cancelled: !!o.cancelledAt,
      subscription: String(o.sourceName || '').startsWith('subscription_contract'),
    });
  }
  for (const id of subs) if (orders.has(id)) orders.get(id).subscription = true;
  return { orders: [...orders.values()], exportedAt: st.completedAt };
}
