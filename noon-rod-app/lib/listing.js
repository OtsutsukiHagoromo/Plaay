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
