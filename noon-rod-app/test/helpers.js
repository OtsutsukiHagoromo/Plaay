import { loadConfig } from '../lib/config.js';
import { NoonError } from '../lib/noon.js';

export const cfg = loadConfig({
  NOON_OUTLET_CODE: 'PLAAYWH01',
  NOON_WEBHOOK_KEY: 'noon-secret',
  SHOPIFY_WEBHOOK_SECRET: 'shopify-secret',
  APP_URL: 'https://noon.example.com',
  TRACKING_SECRET: 'track-secret',
  DASHBOARD_PASSWORD: 'pw',
});

export function makeOrder(overrides = {}) {
  return {
    id: 'gid://shopify/Order/5550001',
    legacyResourceId: '5550001',
    name: '#1234',
    createdAt: '2026-09-30T08:00:00Z',
    cancelledAt: null,
    tags: ['noon-express'],
    note: 'Please call on arrival',
    phone: null,
    displayFinancialStatus: 'PAID',
    paymentGatewayNames: ['shopify_payments'],
    currentSubtotalLineItemsQuantity: 3,
    totalPriceSet: { shopMoney: { amount: '125.50', currencyCode: 'AED' } },
    totalOutstandingSet: { shopMoney: { amount: '0.0', currencyCode: 'AED' } },
    shippingLine: { title: 'Express delivery (Dubai, 60 min)', code: 'express' },
    shippingAddress: {
      name: 'Aisha Khan',
      firstName: 'Aisha',
      lastName: 'Khan',
      company: null,
      address1: 'Apt 1204, Marina Gate 2',
      address2: 'Dubai Marina',
      city: 'Dubai',
      province: 'Dubai',
      countryCodeV2: 'AE',
      phone: '050 123 4567',
      latitude: 25.0877,
      longitude: 55.1477,
    },
    billingAddress: { phone: null },
    fulfillmentOrders: { nodes: [{ id: 'gid://shopify/FulfillmentOrder/1', status: 'OPEN' }] },
    noon: { taskNr: '', status: '', error: '', fulfillmentId: '' },
    ...overrides,
  };
}

// In-memory stand-in for lib/shopify.js with call recording.
export function fakeShopify(initial) {
  const order = initial && structuredClone(initial);
  const calls = [];
  const rec = (name, ...args) => calls.push([name, ...args]);
  const keyMap = { task_nr: 'taskNr', status: 'status', error: 'error', fulfillment_id: 'fulfillmentId' };
  return {
    calls,
    order,
    webhooks: [],
    scopes: ['write_orders', 'write_merchant_managed_fulfillment_orders'],
    async graphql(query, vars) {
      rec('graphql', vars);
      if (query.includes('webhookSubscriptionCreate')) {
        this.webhooks.push({ topic: vars.topic, uri: vars.sub.uri });
        return { webhookSubscriptionCreate: { userErrors: [] } };
      }
      return {
        shop: { name: 'Plaay', myshopifyDomain: 'plaay-store.myshopify.com' },
        currentAppInstallation: { app: { title: 'TMS' }, accessScopes: this.scopes.map((handle) => ({ handle })) },
        webhookSubscriptions: { nodes: this.webhooks },
      };
    },
    async getOrder() {
      return order ? structuredClone(order) : null;
    },
    async findOrderByName(name) {
      return order && order.name === name ? structuredClone(order) : null;
    },
    async listOrdersByTag() {
      return order ? [structuredClone(order)] : [];
    },
    async setNoonState(id, fields) {
      rec('setNoonState', fields);
      for (const [k, v] of Object.entries(fields)) order.noon[keyMap[k]] = v;
    },
    async addTags(id, tags) {
      rec('addTags', tags);
      order.tags = [...new Set([...order.tags, ...tags])];
    },
    async removeTags(id, tags) {
      rec('removeTags', tags);
      order.tags = order.tags.filter((t) => !tags.includes(t));
    },
    async createFulfillment(o, opts) {
      rec('createFulfillment', opts);
      return 'gid://shopify/Fulfillment/77';
    },
    async createFulfillmentEvent(id, status) {
      rec('createFulfillmentEvent', id, status);
    },
  };
}

export function fakeNoon({ createError, taskStatus = 'pending_assignment', task, sequence } = {}) {
  const calls = [];
  return {
    calls,
    async createTask(payload, key) {
      calls.push(['createTask', payload, key]);
      if (createError) throw new NoonError(createError.message, createError.status, null);
      return { mp_task_nr: 'TASK123', status: 'successful' };
    },
    // `sequence` returns successive statuses on successive calls (the last one repeats).
    async getTask(nr) {
      calls.push(['getTask', nr]);
      if (sequence) return { status_code: sequence[Math.min(calls.filter((c) => c[0] === 'getTask').length - 1, sequence.length - 1)] };
      return task || { status_code: taskStatus };
    },
    async getTasks(nrs) {
      calls.push(['getTasks', nrs]);
      return nrs.map(() => task || { status_code: taskStatus });
    },
    async cancelTask(nr) {
      calls.push(['cancelTask', nr]);
      return { status: 'successful' };
    },
  };
}

export const quietLog = { info() {}, warn() {}, error() {} };
