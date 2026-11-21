import trufflesMix6 from './listings/truffles-mix-pack-of-6.json' with { type: 'json' };

// Product listings: read how an existing product is set up (to copy its pattern), and create a
// new one from a spec in code (lib/listings/*.js). Used from the dashboard (password protected).

const PRODUCT_FIELDS = `id legacyResourceId handle title status productType vendor tags templateSuffix descriptionHtml
  seo { title description }
  options { name values }
  collections(first: 20) { nodes { id handle title ruleSet { rules { column relation condition } } } }
  media(first: 20) { nodes { alt mediaContentType ... on MediaImage { image { url } } } }
  metafields(first: 60) { nodes { namespace key type value reference { ... on MediaImage { image { url } } } } }
  resourcePublicationsV2(first: 10) { nodes { isPublished publication { name } } }
  sellingPlanGroups(first: 5) { nodes { id name } }
  variants(first: 10) { nodes { id title sku barcode price compareAtPrice taxable inventoryPolicy
    inventoryItem { tracked measurement { weight { value unit } } }
    inventoryQuantity } }`;

export async function readProduct(shopify, handle) {
  const r = await shopify.graphql(`query($h: String!) { productByIdentifier(identifier: { handle: $h }) { ${PRODUCT_FIELDS} } }`, { h: handle });
  return r.productByIdentifier;
}

// Create (or update, by handle) a product from a spec in lib/listings/<handle>.json: details,
// tabs (metafields), page template, collections, image (served by this app), sales channels.
export async function createListing(shopify, spec, appUrl) {
  const input = {
    handle: spec.handle,
    title: spec.title,
    descriptionHtml: spec.descriptionHtml,
    productType: spec.productType,
    vendor: spec.vendor,
    tags: spec.tags,
    status: 'ACTIVE',
    templateSuffix: spec.templateSuffix,
    seo: spec.seo,
    metafields: spec.metafields,
    collections: spec.collections,
    productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
    variants: [{
      optionValues: [{ optionName: 'Title', name: 'Default Title' }],
      price: spec.price,
      taxable: true,
      inventoryPolicy: 'CONTINUE',
      inventoryItem: { tracked: true },
    }],
  };
  const existing = await readProduct(shopify, spec.handle);
  if (!existing?.media?.nodes?.length && spec.image) {
    input.files = [{ originalSource: `${appUrl}/${spec.image.path}`, alt: spec.image.alt, contentType: 'IMAGE' }];
  }
  const r = await shopify.graphql(
    `mutation($input: ProductSetInput!, $identifier: ProductSetIdentifiers) {
      productSet(input: $input, identifier: $identifier, synchronous: true) { product { id handle } userErrors { field message code } } }`,
    { input, identifier: existing ? { handle: spec.handle } : null },
  );
  const e = r.productSet.userErrors;
  if (e.length) throw new Error(e.map((x) => `${(x.field || []).join('.')}: ${x.message}`).join('; '));
  const id = r.productSet.product.id;
  const pubs = await shopify.graphql('{ publications(first: 20) { nodes { id name } } }');
  const want = pubs.publications.nodes.filter((p) => spec.publications.includes(p.name)).map((p) => ({ publicationId: p.id }));
  if (want.length) {
    const p = await shopify.graphql('mutation($id: ID!, $in: [PublicationInput!]!) { publishablePublish(id: $id, input: $in) { userErrors { field message } } }', { id, in: want });
    const pe = p.publishablePublish.userErrors;
    if (pe.length) throw new Error(`publish: ${pe.map((x) => x.message).join('; ')}`);
  }
  return { id, handle: r.productSet.product.handle, channels: want.length, updated: !!existing };
}

// Specs the dashboard can create (bundled with the app).
export const LISTINGS = { 'truffles-mix-pack-of-6': trufflesMix6 };

// Add an image (served by this app from public/listing/) to a product at a position (1-based),
// optionally removing the product's current images first.
export async function addImage(shopify, { handle, file, alt, position, replace }, appUrl) {
  const p = await readProduct(shopify, handle);
  if (!p) throw new Error(`No product ${handle}`);
  const old = await shopify.graphql('query($id: ID!) { product(id: $id) { media(first: 50) { nodes { id } } } }', { id: p.id });
  const before = old.product.media.nodes.map((m) => m.id);
  const c = await shopify.graphql(
    `mutation($id: ID!, $media: [CreateMediaInput!]!) { productCreateMedia(productId: $id, media: $media) {
      media { id } mediaUserErrors { field message } } }`,
    { id: p.id, media: [{ originalSource: `${appUrl}/listing/${file}`, alt, mediaContentType: 'IMAGE' }] },
  );
  const ce = c.productCreateMedia.mediaUserErrors;
  if (ce.length) throw new Error(ce.map((x) => x.message).join('; '));
  const newId = c.productCreateMedia.media[0].id;
  if (replace && before.length) {
    const d = await shopify.graphql('mutation($id: ID!, $ids: [ID!]!) { productDeleteMedia(productId: $id, mediaIds: $ids) { mediaUserErrors { field message } } }', { id: p.id, ids: before });
    const de = d.productDeleteMedia.mediaUserErrors;
    if (de.length) throw new Error(de.map((x) => x.message).join('; '));
  } else if (position && position <= before.length) {
    const r = await shopify.graphql('mutation($id: ID!, $moves: [MoveInput!]!) { productReorderMedia(id: $id, moves: $moves) { mediaUserErrors { field message } } }', { id: p.id, moves: [{ id: newId, newPosition: String(position - 1) }] });
    const re = r.productReorderMedia.mediaUserErrors;
    if (re.length) throw new Error(re.map((x) => x.message).join('; '));
  }
  return { handle, images: (replace ? 1 : before.length + 1) };
}
