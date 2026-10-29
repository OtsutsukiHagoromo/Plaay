// Express controls kept in Shopify, so the team can change them from the dashboard without a
// redeploy: shop metafields plaay_express.paused and plaay_express.checkout (off | preview | on),
// and the carrier service that gives Shopify checkout the Express and 4-hour rates.

const NS = 'plaay_express';
export const CARRIER_NAME = 'Plaay Express';

let cached = null; // { at, value }

// Settings from env, with the dashboard's choices on top (cached for a minute).
export async function liveSettings(d) {
  const base = d.cfg.express;
  if (!d.shopify?.graphql) return base;
  if (!cached || Date.now() - cached.at > 60_000) {
    try {
      const data = await d.shopify.graphql(`{ shop {
        paused: metafield(namespace: "${NS}", key: "paused") { value }
        checkout: metafield(namespace: "${NS}", key: "checkout") { value }
      } }`);
      cached = { at: Date.now(), value: { paused: data.shop.paused?.value, checkout: data.shop.checkout?.value } };
    } catch {
      cached = { at: Date.now(), value: {} };
    }
  }
  const v = cached.value;
  return {
    ...base,
    paused: v.paused != null ? v.paused === 'true' : base.paused,
    checkout: ['off', 'preview', 'on'].includes(v.checkout) ? v.checkout : base.checkout,
  };
}

export const forgetSettings = () => { cached = null; };

export async function setSetting(shopify, key, value) {
  const { shop } = await shopify.graphql('{ shop { id } }');
  const data = await shopify.graphql(
    `mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }`,
    { m: [{ ownerId: shop.id, namespace: NS, key, type: 'single_line_text_field', value: String(value) }] },
  );
  const errs = data.metafieldsSet.userErrors;
  if (errs.length) throw new Error(errs.map((e) => e.message).join('; '));
  forgetSettings();
}

const callbackUrl = (cfg) => `${cfg.appUrl}/api/rates`;

// Plan, carrier service and whether it's in the UAE shipping zone. Never throws.
export async function checkoutStatus(shopify, cfg) {
  const out = { plan: null, carrier: null, inZone: null, errors: [] };
  try {
    const data = await shopify.graphql('{ shop { plan { publicDisplayName shopifyPlus partnerDevelopment } } }');
    out.plan = data.shop.plan;
  } catch (err) {
    out.errors.push(`plan: ${err.message}`);
  }
  try {
    const data = await shopify.graphql('{ carrierServices(first: 20) { nodes { id name callbackUrl active } } }');
    out.carrier = data.carrierServices.nodes.find((c) => c.callbackUrl === callbackUrl(cfg) || c.name === CARRIER_NAME) || null;
  } catch (err) {
    out.errors.push(`carrier services: ${err.message}`);
  }
  try {
    out.zones = await uaeZones(shopify);
    if (out.carrier) out.inZone = out.zones.some((z) => z.carrierIds.includes(out.carrier.id));
  } catch (err) {
    out.errors.push(`shipping zones: ${err.message}`);
  }
  return out;
}

// Shipping zones that deliver to the UAE, in every shipping profile, with the carrier services
// already added to them.
async function uaeZones(shopify) {
  const data = await shopify.graphql(`{ deliveryProfiles(first: 10) { nodes { id name
    profileLocationGroups { locationGroup { id }
      locationGroupZones(first: 30) { nodes {
        zone { id name countries { code { countryCode } provinces { name code } } }
        methodDefinitions(first: 30) { nodes { id name active description
          rateProvider { ... on DeliveryParticipant { carrierService { id } } ... on DeliveryRateDefinition { id price { amount currencyCode } } }
          methodConditions { field operator conditionCriteria { ... on MoneyV2 { amount currencyCode } ... on Weight { value unit } } }
        } }
      } }
    }
  } } }`);
  const zones = [];
  for (const p of data.deliveryProfiles.nodes) {
    for (const g of p.profileLocationGroups) {
      for (const z of g.locationGroupZones.nodes) {
        if (!z.zone.countries.some((c) => c.code.countryCode === 'AE')) continue;
        zones.push({
          profileId: p.id,
          profile: p.name,
          groupId: g.locationGroup.id,
          zoneId: z.zone.id,
          zone: z.zone.name,
          carrierIds: z.methodDefinitions.nodes.map((m) => m.rateProvider?.carrierService?.id).filter(Boolean),
          countries: z.zone.countries.map((c) => `${c.code.countryCode}${c.provinces.length ? ` (${c.provinces.map((p) => p.code).join(', ')})` : ''}`),
          rates: z.methodDefinitions.nodes.map((m) => ({
            id: m.id, name: m.name, active: m.active, description: m.description,
            price: m.rateProvider?.price ? `${m.rateProvider.price.amount} ${m.rateProvider.price.currencyCode}` : 'carrier',
            conditions: m.methodConditions.map((c) => `${c.field} ${c.operator} ${c.conditionCriteria.amount ?? c.conditionCriteria.value}`),
          })),
        });
      }
    }
  }
  return zones;
}

// Register (or refresh) the carrier service and add it to every UAE zone. Standard delivery stays
// the store's own rate.
export { uaeZones };

export async function enableCheckoutRates(shopify, cfg) {
  const status = await checkoutStatus(shopify, cfg);
  let id = status.carrier?.id;
  if (id) {
    const r = await shopify.graphql(
      `mutation($input: DeliveryCarrierServiceUpdateInput!) { carrierServiceUpdate(input: $input) { carrierService { id } userErrors { field message } } }`,
      { input: { id, name: CARRIER_NAME, callbackUrl: callbackUrl(cfg), active: true, supportsServiceDiscovery: false } },
    );
    const e = r.carrierServiceUpdate.userErrors;
    if (e.length) throw new Error(e.map((x) => x.message).join('; '));
  } else {
    const r = await shopify.graphql(
      `mutation($input: DeliveryCarrierServiceCreateInput!) { carrierServiceCreate(input: $input) { carrierService { id } userErrors { field message } } }`,
      { input: { name: CARRIER_NAME, callbackUrl: callbackUrl(cfg), active: true, supportsServiceDiscovery: false } },
    );
    const e = r.carrierServiceCreate.userErrors;
    if (e.length) throw new Error(e.map((x) => x.message).join('; '));
    id = r.carrierServiceCreate.carrierService.id;
  }
  const added = [];
  for (const z of await uaeZones(shopify)) {
    if (z.carrierIds.includes(id)) continue;
    const r = await shopify.graphql(
      `mutation($id: ID!, $profile: DeliveryProfileInput!) { deliveryProfileUpdate(id: $id, profile: $profile) { profile { id } userErrors { field message } } }`,
      {
        id: z.profileId,
        profile: {
          locationGroupsToUpdate: [{
            id: z.groupId,
            zonesToUpdate: [{
              id: z.zoneId,
              methodDefinitionsToCreate: [{ name: CARRIER_NAME, active: true, participant: { carrierServiceId: id, adaptToNewServices: true, participantServices: [] } }],
            }],
          }],
        },
      },
    );
    const e = r.deliveryProfileUpdate.userErrors;
    if (e.length) throw new Error(`${z.zone}: ${e.map((x) => x.message).join('; ')}`);
    added.push(z.zone);
  }
  return { id, added };
}

export async function disableCheckoutRates(shopify, cfg) {
  const status = await checkoutStatus(shopify, cfg);
  if (!status.carrier) return { removed: false };
  const r = await shopify.graphql(
    `mutation($id: ID!) { carrierServiceDelete(id: $id) { deletedId userErrors { field message } } }`,
    { id: status.carrier.id },
  );
  const e = r.carrierServiceDelete.userErrors;
  if (e.length) throw new Error(e.map((x) => x.message).join('; '));
  return { removed: true };
}
