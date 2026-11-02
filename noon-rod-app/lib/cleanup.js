// Brand clean-up: find every mention of a term (e.g. a brand the store must stop using) across
// the store through the Admin API, including archived products, files, alt text, SEO, menus,
// tags and metafields (reviews apps keep review text there), and remove what is found.

const PAGE = 100;

async function all(shopify, field, fields, query = '') {
  const out = [];
  let after = null;
  for (let i = 0; i < 20; i++) {
    const data = await shopify.graphql(
      query === null
        ? `query($after: String) { ${field}(first: ${PAGE}, after: $after) { nodes { ${fields} } pageInfo { hasNextPage endCursor } } }`
        : `query($after: String, $q: String) { ${field}(first: ${PAGE}, after: $after, query: $q) { nodes { ${fields} } pageInfo { hasNextPage endCursor } } }`,
      query === null ? { after } : { after, q: query || null },
    );
    out.push(...data[field].nodes);
    if (!data[field].pageInfo.hasNextPage) break;
    after = data[field].pageInfo.endCursor;
  }
  return out;
}

const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

function scan(hits, kind, item, label, fields, re) {
  for (const [name, value] of Object.entries(fields)) {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    const m = text.match(re);
    if (!m) continue;
    const plain = strip(text);
    const i = plain.search(re);
    hits.push({ kind, id: item.id, label, field: name, snippet: i < 0 ? plain.slice(0, 160) : plain.slice(Math.max(0, i - 70), i + 90) });
  }
}

export async function findMentions(shopify, terms = ['biscoff', 'lotus']) {
  const re = new RegExp(terms.join('|'), 'i');
  const hits = [];
  const errors = [];
  const safe = async (name, fn) => {
    try { await fn(); } catch (err) { errors.push(`${name}: ${err.message}`); }
  };

  await safe('products', async () => {
    const products = await all(shopify, 'products', `id title handle status descriptionHtml tags vendor productType onlineStoreUrl
      seo { title description }
      media(first: 50) { nodes { alt ... on MediaImage { image { url } } } }
      metafields(first: 50) { nodes { namespace key value } }`, 'status:active OR status:draft OR status:archived');
    for (const p of products) {
      const label = `${p.title} (${p.status.toLowerCase()}, /products/${p.handle})`;
      scan(hits, 'product', p, label, {
        title: p.title, handle: p.handle, description: p.descriptionHtml, tags: p.tags.join(', '), vendor: p.vendor, type: p.productType,
        'SEO title': p.seo.title, 'SEO description': p.seo.description,
        'image alt': p.media.nodes.map((m) => m.alt).join(' | '),
        'image file': p.media.nodes.map((m) => m.image?.url || '').join(' | '),
      }, re);
      for (const mf of p.metafields.nodes) scan(hits, 'product', p, label, { [`metafield ${mf.namespace}.${mf.key}`]: mf.value }, re);
    }
  });
  await safe('collections', async () => {
    const cs = await all(shopify, 'collections', 'id title handle descriptionHtml seo { title description } image { altText url } metafields(first: 30) { nodes { namespace key value } }');
    for (const c of cs) {
      const label = `${c.title} (/collections/${c.handle})`;
      scan(hits, 'collection', c, label, { title: c.title, handle: c.handle, description: c.descriptionHtml, 'SEO title': c.seo.title, 'SEO description': c.seo.description, 'image alt': c.image?.altText, 'image file': c.image?.url }, re);
      for (const mf of c.metafields.nodes) scan(hits, 'collection', c, label, { [`metafield ${mf.namespace}.${mf.key}`]: mf.value }, re);
    }
  });
  await safe('pages', async () => {
    const ps = await all(shopify, 'pages', 'id title handle body bodySummary isPublished metafields(first: 30) { nodes { namespace key value } }');
    for (const p of ps) {
      const label = `${p.title} (/pages/${p.handle})`;
      scan(hits, 'page', p, label, { title: p.title, handle: p.handle, body: p.body }, re);
      for (const mf of p.metafields.nodes) scan(hits, 'page', p, label, { [`metafield ${mf.namespace}.${mf.key}`]: mf.value }, re);
    }
  });
  await safe('blog posts', async () => {
    const as = await all(shopify, 'articles', 'id title handle body summary tags isPublished image { altText url } blog { handle } metafields(first: 30) { nodes { namespace key value } }');
    for (const a of as) {
      const label = `${a.title} (/blogs/${a.blog?.handle}/${a.handle})`;
      scan(hits, 'article', a, label, { title: a.title, handle: a.handle, body: a.body, summary: a.summary, tags: a.tags.join(', '), 'image alt': a.image?.altText, 'image file': a.image?.url }, re);
      for (const mf of a.metafields.nodes) scan(hits, 'article', a, label, { [`metafield ${mf.namespace}.${mf.key}`]: mf.value }, re);
    }
  });
  await safe('menus', async () => {
    const data = await shopify.graphql('{ menus(first: 50) { nodes { id title handle items { title url items { title url items { title url } } } } } }');
    for (const m of data.menus.nodes) scan(hits, 'menu', m, `${m.title} menu`, { items: m.items }, re);
  });
  await safe('files', async () => {
    for (const t of terms) {
      const fs = await all(shopify, 'files', 'id alt createdAt fileStatus ... on MediaImage { image { url } } ... on GenericFile { url } ... on Video { filename }', t);
      for (const f of fs) {
        const url = f.image?.url || f.url || f.filename || '';
        if (hits.some((h) => h.id === f.id)) continue;
        scan(hits, 'file', f, url.split('/').pop()?.split('?')[0] || f.id, { alt: f.alt, file: url }, re);
      }
    }
  });
  await safe('redirects', async () => {
    const rs = await all(shopify, 'urlRedirects', 'id path target', null);
    for (const r of rs) scan(hits, 'redirect', r, `${r.path} → ${r.target}`, { path: r.path, target: r.target }, re);
  });
  await safe('shop', async () => {
    const data = await shopify.graphql('{ shop { id name description metafields(first: 100) { nodes { namespace key value } } } }');
    const s = data.shop;
    scan(hits, 'shop', s, 'Store settings', { description: s.description }, re);
    for (const mf of s.metafields.nodes) scan(hits, 'shop', s, 'Store settings', { [`metafield ${mf.namespace}.${mf.key}`]: mf.value }, re);
  });
  return { hits, errors, at: new Date().toISOString() };
}

// Remove what findMentions finds that can be removed outright: archived products (deleted, so
// their URL stops working, with no redirect) and files. Anything else is reported for editing.
export async function removeMentions(shopify, terms) {
  const { hits } = await findMentions(shopify, terms);
  const done = [];
  const left = [];
  const products = [...new Map(hits.filter((h) => h.kind === 'product').map((h) => [h.id, h])).values()];
  for (const p of products) {
    if (!/\(archived,/.test(p.label)) { left.push(p.label); continue; }
    const r = await shopify.graphql('mutation($input: ProductDeleteInput!) { productDelete(input: $input) { deletedProductId userErrors { message } } }', { input: { id: p.id } });
    const e = r.productDelete.userErrors;
    if (e.length) throw new Error(`${p.label}: ${e.map((x) => x.message).join('; ')}`);
    done.push(`deleted product ${p.label}`);
  }
  const files = [...new Map(hits.filter((h) => h.kind === 'file').map((h) => [h.id, h])).values()];
  if (files.length) {
    const r = await shopify.graphql('mutation($ids: [ID!]!) { fileDelete(fileIds: $ids) { deletedFileIds userErrors { message } } }', { ids: files.map((f) => f.id) });
    const e = r.fileDelete.userErrors;
    if (e.length) throw new Error(`files: ${e.map((x) => x.message).join('; ')}`);
    done.push(...files.map((f) => `deleted file ${f.label}`));
  }
  for (const h of hits) if (!['product', 'file'].includes(h.kind)) left.push(`${h.label} (${h.field})`);
  return { done, left: [...new Set(left)] };
}

// Proof a product wasn't on sale: status, sales channels, stock, dates and orders that contain it.
export async function productEvidence(shopify, id) {
  const data = await shopify.graphql(`query($id: ID!) { product(id: $id) {
    id title handle status createdAt updatedAt publishedAt onlineStoreUrl totalInventory tracksInventory
    resourcePublicationsV2(first: 20, onlyPublished: false) { nodes { isPublished publishDate publication { name } } }
    variants(first: 20) { nodes { id title sku price inventoryQuantity } }
  } }`, { id });
  const p = data.product;
  if (!p) return null;
  const legacyId = p.id.split('/').pop();
  const orders = { byProduct: null, bySku: [] };
  try {
    // Only orders whose line items really contain this product (a search filter Shopify
    // doesn't support would otherwise return every order).
    const found = [];
    let after = null;
    for (let i = 0; i < 20; i++) {
      const r = await shopify.graphql(
        'query($q: String!, $after: String) { orders(first: 50, after: $after, query: $q, sortKey: CREATED_AT) { nodes { name createdAt displayFinancialStatus cancelledAt lineItems(first: 50) { nodes { quantity product { id } } } } pageInfo { hasNextPage endCursor } } }',
        { q: `product_id:${legacyId}`, after },
      );
      for (const o of r.orders.nodes) {
        const qty = o.lineItems.nodes.filter((li) => li.product?.id === p.id).reduce((n, li) => n + li.quantity, 0);
        orders.scanned = (orders.scanned || 0) + 1;
        if (qty) found.push({ name: o.name, createdAt: o.createdAt, qty, status: o.displayFinancialStatus, cancelled: !!o.cancelledAt });
      }
      if (!r.orders.pageInfo.hasNextPage) break;
      after = r.orders.pageInfo.endCursor;
    }
    orders.byProduct = found;
  } catch (err) {
    orders.byProductError = err.message;
  }
  for (const v of p.variants.nodes.filter((x) => x.sku)) {
    try {
      const r = await shopify.graphql('query($q: String!) { orders(first: 50, query: $q) { nodes { name createdAt } } }', { q: `sku:${JSON.stringify(v.sku)}` });
      orders.bySku.push({ sku: v.sku, orders: r.orders.nodes });
    } catch (err) {
      orders.bySku.push({ sku: v.sku, error: err.message });
    }
  }
  return { product: p, orders, checkedAt: new Date().toISOString() };
}
