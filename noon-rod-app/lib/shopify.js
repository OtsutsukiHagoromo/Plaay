// Shopify Admin GraphQL client plus the handful of operations this app needs.
// All noon state lives on the order itself (tags + "noon" metafields), so the app needs no database.

import crypto from 'node:crypto';
import { METAFIELD_NAMESPACE } from './config.js';

export class ShopifyError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ShopifyError';
    this.details = details;
  }
}

export const ORDER_FIELDS = `
  id
  legacyResourceId
  name
  createdAt
  cancelledAt
  tags
  note
  phone
  displayFinancialStatus
  displayFulfillmentStatus
  paymentGatewayNames
  currentSubtotalLineItemsQuantity
  totalPriceSet { shopMoney { amount currencyCode } }
  totalOutstandingSet { shopMoney { amount currencyCode } }
  shippingLine { title code }
  shippingAddress {
    name firstName lastName company address1 address2 city province countryCodeV2 phone latitude longitude
  }
  billingAddress { phone }
  taskNr: metafield(namespace: "${METAFIELD_NAMESPACE}", key: "task_nr") { value }
  noonStatus: metafield(namespace: "${METAFIELD_NAMESPACE}", key: "status") { value }
  noonError: metafield(namespace: "${METAFIELD_NAMESPACE}", key: "error") { value }
  fulfillmentId: metafield(namespace: "${METAFIELD_NAMESPACE}", key: "fulfillment_id") { value }
  fulfillmentOrders(first: 10) { nodes { id status } }
`;

export function orderGid(id) {
  return String(id).startsWith('gid://') ? String(id) : `gid://shopify/Order/${id}`;
}

// Flatten the aliased metafields into order.noon = { taskNr, status, error, fulfillmentId }.
export function normalizeOrder(o) {
  if (!o) return null;
  const { taskNr, noonStatus, noonError, fulfillmentId, ...rest } = o;
  return {
    ...rest,
    noon: {
      taskNr: taskNr?.value || '',
      status: noonStatus?.value || '',
      error: noonError?.value || '',
      fulfillmentId: fulfillmentId?.value || '',
    },
  };
}

export function verifyWebhookHmac(rawBody, hmacHeader, secret) {
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(digest);
  const b = Buffer.from(String(hmacHeader));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createShopifyClient(cfg, fetchImpl = globalThis.fetch) {
  let cachedToken = cfg.adminToken ? { value: cfg.adminToken, expiresAt: Infinity } : null;

  // Dev Dashboard apps installed on our own store can use the client credentials grant.
  async function accessToken() {
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
    if (!cfg.clientId || !cfg.clientSecret) {
      throw new ShopifyError('Set SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET');
    }
    const res = await fetchImpl(`https://${cfg.shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) throw new ShopifyError(`Shopify token request failed (${res.status})`, data);
    cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
    return cachedToken.value;
  }

  async function graphql(query, variables = {}) {
    const res = await fetchImpl(`https://${cfg.shop}/admin/api/${cfg.apiVersion}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await accessToken() },
      body: JSON.stringify({ query, variables }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.errors) {
      throw new ShopifyError(`Shopify GraphQL failed (${res.status}): ${JSON.stringify(data.errors || data).slice(0, 300)}`, data);
    }
    return data.data;
  }

  // Run a mutation and throw on userErrors.
  async function mutate(query, variables, field) {
    const data = await graphql(query, variables);
    const result = data[field];
    if (result?.userErrors?.length) {
      throw new ShopifyError(`${field}: ${result.userErrors.map((e) => e.message).join('; ')}`, result.userErrors);
    }
    return result;
  }

  return {
    graphql,

    async getOrder(id) {
      const data = await graphql(`query($id: ID!) { order(id: $id) { ${ORDER_FIELDS} } }`, { id: orderGid(id) });
      return normalizeOrder(data.order);
    },

    async findOrderByName(name) {
      const data = await graphql(
        `query($q: String!) { orders(first: 1, query: $q) { nodes { ${ORDER_FIELDS} } } }`,
        { q: `name:${JSON.stringify(name)}` },
      );
      const order = normalizeOrder(data.orders.nodes[0]);
      return order && order.name === name ? order : null;
    },

    async listOrdersByTag(tag, first = 50) {
      const data = await graphql(
        `query($q: String!, $first: Int!) {
          orders(first: $first, query: $q, sortKey: CREATED_AT, reverse: true) { nodes { ${ORDER_FIELDS} } }
        }`,
        { q: `tag:${JSON.stringify(tag)}`, first },
      );
      return data.orders.nodes.map(normalizeOrder);
    },

    // fields: { task_nr, status, error, fulfillment_id } -> noon.* metafields. Empty string clears the value.
    async setNoonState(orderId, fields) {
      const entries = Object.entries(fields);
      const toSet = entries.filter(([, v]) => v !== '');
      const toDelete = entries.filter(([, v]) => v === '');
      if (toSet.length) {
        await mutate(
          `mutation($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { field message } } }`,
          {
            m: toSet.map(([key, value]) => ({
              ownerId: orderGid(orderId),
              namespace: METAFIELD_NAMESPACE,
              key,
              type: 'single_line_text_field',
              value: String(value).slice(0, 255),
            })),
          },
          'metafieldsSet',
        );
      }
      if (toDelete.length) {
        await mutate(
          `mutation($m: [MetafieldIdentifierInput!]!) { metafieldsDelete(metafields: $m) { userErrors { field message } } }`,
          { m: toDelete.map(([key]) => ({ ownerId: orderGid(orderId), namespace: METAFIELD_NAMESPACE, key })) },
          'metafieldsDelete',
        );
      }
    },

    addTags: (orderId, tags) =>
      mutate(
        `mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }`,
        { id: orderGid(orderId), tags },
        'tagsAdd',
      ),

    removeTags: (orderId, tags) =>
      mutate(
        `mutation($id: ID!, $tags: [String!]!) { tagsRemove(id: $id, tags: $tags) { userErrors { field message } } }`,
        { id: orderGid(orderId), tags },
        'tagsRemove',
      ),

    // Fulfil every open fulfillment order with a noon tracking link; Shopify emails the customer.
    async createFulfillment(order, { taskNr, trackingUrl, notifyCustomer = true }) {
      const open = (order.fulfillmentOrders?.nodes || []).filter((fo) => ['OPEN', 'IN_PROGRESS'].includes(fo.status));
      if (!open.length) throw new ShopifyError(`${order.name} has no open fulfillment orders`);
      const result = await mutate(
        `mutation($f: FulfillmentInput!) {
          fulfillmentCreate(fulfillment: $f) { fulfillment { id } userErrors { field message } }
        }`,
        {
          f: {
            lineItemsByFulfillmentOrder: open.map((fo) => ({ fulfillmentOrderId: fo.id })),
            notifyCustomer,
            trackingInfo: { company: 'noon', number: taskNr, ...(trackingUrl ? { url: trackingUrl } : {}) },
          },
        },
        'fulfillmentCreate',
      );
      return result.fulfillment.id;
    },

    // status: a FulfillmentEventStatus, e.g. OUT_FOR_DELIVERY, DELIVERED, FAILURE.
    createFulfillmentEvent: (fulfillmentId, status, message) =>
      mutate(
        `mutation($e: FulfillmentEventInput!) {
          fulfillmentEventCreate(fulfillmentEvent: $e) { fulfillmentEvent { id } userErrors { field message } }
        }`,
        { e: { fulfillmentId, status, happenedAt: new Date().toISOString(), ...(message ? { message } : {}) } },
        'fulfillmentEventCreate',
      ),
  };
}
