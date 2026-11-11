// Express test on the live store, hidden from shoppers.
//
// A copy of one product is made, reachable only by its link (status UNLISTED: not in collections,
// search or the sitemap). The copy sits in its own delivery profile whose only rate is Plaay
// Express (2-hour, Dubai), so nothing changes for any other product or customer. Order the copy
// on the website with a Dubai address to place a real test order; the app tags it noon-express
// and staff press Dispatch as usual. The store's normal delivery rate is copied in too, so
// checkout shows both choices as it will at launch. Turning the test off deletes the profile and the copy.

import { copyRate, uaeZones } from './express-admin.js';

export const TEST_PROFILE = 'Plaay Express test (hidden)';
export const TEST_TAG = 'express-test';
export const TEST_RATE = {
  name: 'Plaay Express (Dubai, 2-hour delivery)',
  description: 'Order by 5 pm, Mon–Sat. Delivered within 2 hours.',
};

const errs = (e) => {
  if (e?.length) throw new Error(e.map((x) => `${(x.field || []).join('.')} ${x.message}`.trim()).join('; '));
};

async function findTest(shopify) {
  const data = await shopify.graphql(`{
    deliveryProfiles(first: 20) { nodes { id name } }
    products(first: 5, query: "tag:${TEST_TAG}") { nodes { id title handle status onlineStorePreviewUrl onlineStoreUrl variants(first: 10) { nodes { id } } } }
  }`);
  return {
    profile: data.deliveryProfiles.nodes.find((p) => p.name === TEST_PROFILE) || null,
    products: data.products.nodes,
  };
}

export async function testStatus(shopify) {
  const t = await findTest(shopify);
  return { on: !!t.profile, profile: t.profile, products: t.products };
}

const rate = (amount, conditions) => ({
  name: TEST_RATE.name,
  description: TEST_RATE.description,
  active: true,
  rateDefinition: { price: { amount, currencyCode: 'AED' } },
  priceConditionsToCreate: conditions,
});

// The store's normal rates for Dubai (from the main profile), as create inputs.
async function standardRates(shopify) {
  const zones = (await uaeZones(shopify)).filter((z) => z.profile !== TEST_PROFILE);
  const dubai = zones.find((z) => z.countries.some((c) => c === 'AE' || (c.startsWith('AE (') && /\bDU\b/.test(c))));
  if (!dubai) return [];
  return dubai.rates.filter((r) => r.price !== 'carrier' && r.active).map((r) => copyRate(r));
}

const expressRates = ({ fee, freeOver }) => [
  rate(0, [{ operator: 'GREATER_THAN_OR_EQUAL_TO', criteria: { amount: freeOver, currencyCode: 'AED' } }]),
  rate(fee, [{ operator: 'LESS_THAN_OR_EQUAL_TO', criteria: { amount: freeOver - 0.01, currencyCode: 'AED' } }]),
];

// Bring an existing test profile up to date: current Express wording, normal rates present.
async function syncTest(shopify, profileId) {
  const data = await shopify.graphql(`query($id: ID!) { deliveryProfile(id: $id) { profileLocationGroups { locationGroup { id }
    locationGroupZones(first: 5) { nodes { zone { id } methodDefinitions(first: 20) { nodes { id name description } } } } } } }`, { id: profileId });
  const g = data.deliveryProfile.profileLocationGroups[0];
  const z = g.locationGroupZones.nodes[0];
  const have = z.methodDefinitions.nodes;
  const toUpdate = have.filter((m) => m.name === TEST_RATE.name && m.description !== TEST_RATE.description).map((m) => ({ id: m.id, description: TEST_RATE.description }));
  const toCreate = (await standardRates(shopify)).filter((r) => !have.some((m) => m.name === r.name));
  if (!toUpdate.length && !toCreate.length) return { changed: false };
  const r = await shopify.graphql(
    'mutation($id: ID!, $p: DeliveryProfileInput!) { deliveryProfileUpdate(id: $id, profile: $p) { profile { id } userErrors { field message } } }',
    { id: profileId, p: { locationGroupsToUpdate: [{ id: g.locationGroup.id, zonesToUpdate: [{ id: z.zone.id, methodDefinitionsToUpdate: toUpdate, methodDefinitionsToCreate: toCreate }] }] } },
  );
  errs(r.deliveryProfileUpdate.userErrors);
  return { changed: true, added: toCreate.map((x) => x.name) };
}

export async function enableTest(shopify, handle, { fee = 15, freeOver = 99 } = {}) {
  const t = await findTest(shopify);
  if (t.profile && t.products.length) return { already: true, products: t.products, ...(await syncTest(shopify, t.profile.id)) };

  // 1. The hidden copy.
  let copy = t.products[0];
  if (!copy) {
    const src = await shopify.graphql('query($h: String!) { productByIdentifier(identifier: { handle: $h }) { id title } }', { h: handle });
    const found = src.productByIdentifier;
    if (!found) throw new Error(`No product with the handle "${handle}".`);
    const dup = await shopify.graphql(
      `mutation($id: ID!, $title: String!) { productDuplicate(productId: $id, newTitle: $title, newStatus: UNLISTED, includeImages: true) {
        newProduct { id title handle variants(first: 10) { nodes { id } } } userErrors { field message } } }`,
      { id: found.id, title: `${found.title} (Express test)` },
    );
    errs(dup.productDuplicate.userErrors);
    copy = dup.productDuplicate.newProduct;
    const pid = copy.id;
    const tag = await shopify.graphql('mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }', { id: pid, tags: [TEST_TAG] });
    errs(tag.tagsAdd.userErrors);
    // Copies start with no stock: let them sell so the test order can go through.
    const v = await shopify.graphql(
      'mutation($p: ID!, $v: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $p, variants: $v) { userErrors { field message } } }',
      { p: pid, v: copy.variants.nodes.map((x) => ({ id: x.id, inventoryPolicy: 'CONTINUE' })) },
    );
    errs(v.productVariantsBulkUpdate.userErrors);
    const pubs = await shopify.graphql('{ publications(first: 20) { nodes { id name } } }');
    const online = pubs.publications.nodes.find((p) => /online store/i.test(p.name));
    if (online) {
      const p = await shopify.graphql('mutation($id: ID!, $in: [PublicationInput!]!) { publishablePublish(id: $id, input: $in) { userErrors { field message } } }', { id: pid, in: [{ publicationId: online.id }] });
      errs(p.publishablePublish.userErrors);
    }
  }

  // 2. Its own delivery profile: Dubai only, Express only.
  if (!t.profile) {
    const locs = await shopify.graphql('{ locations(first: 20) { nodes { id isActive fulfillsOnlineOrders } } }');
    const locations = locs.locations.nodes.filter((l) => l.isActive && l.fulfillsOnlineOrders).map((l) => l.id);
    if (!locations.length) throw new Error('No active location that fulfils online orders.');
    const r = await shopify.graphql(
      'mutation($p: DeliveryProfileInput!) { deliveryProfileCreate(profile: $p) { profile { id } userErrors { field message } } }',
      { p: {
        name: TEST_PROFILE,
        variantsToAssociate: copy.variants.nodes.map((x) => x.id),
        locationGroupsToCreate: [{
          locations,
          zonesToCreate: [{
            name: 'Dubai (Express test)',
            countries: [{ code: 'AE', includeAllProvinces: false, provinces: [{ code: 'DU' }] }],
            methodDefinitionsToCreate: [...(await standardRates(shopify)), ...expressRates({ fee, freeOver })],
          }],
        }],
      } },
    );
    errs(r.deliveryProfileCreate.userErrors);
  }
  const done = await findTest(shopify);
  return { already: false, products: done.products };
}

export async function disableTest(shopify) {
  const t = await findTest(shopify);
  if (t.profile) {
    const r = await shopify.graphql('mutation($id: ID!) { deliveryProfileRemove(id: $id) { job { id } userErrors { field message } } }', { id: t.profile.id });
    errs(r.deliveryProfileRemove.userErrors);
  }
  for (const p of t.products) {
    const r = await shopify.graphql('mutation($in: ProductDeleteInput!) { productDelete(input: $in) { deletedProductId userErrors { field message } } }', { in: { id: p.id } });
    errs(r.productDelete.userErrors);
  }
  return { removedProfile: !!t.profile, removedProducts: t.products.map((p) => p.title) };
}
