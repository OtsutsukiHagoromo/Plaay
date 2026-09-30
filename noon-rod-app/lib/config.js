// All settings come from environment variables; see .env.example.

export function loadConfig(env = process.env) {
  return {
    noon: {
      baseUrl: (env.NOON_BASE_URL || 'https://food-api-team.noonstg.team').replace(/\/$/, ''),
      apiKey: env.NOON_API_KEY || '',
      outletCode: env.NOON_OUTLET_CODE || '',
      locale: env.NOON_LOCALE || 'en-ae',
      webhookKey: env.NOON_WEBHOOK_KEY || '',
    },
    shopify: {
      shop: env.SHOPIFY_SHOP || '',
      apiVersion: env.SHOPIFY_API_VERSION || '2026-07',
      adminToken: env.SHOPIFY_ADMIN_TOKEN || '',
      clientId: env.SHOPIFY_CLIENT_ID || '',
      clientSecret: env.SHOPIFY_CLIENT_SECRET || '',
      webhookSecret: env.SHOPIFY_WEBHOOK_SECRET || env.SHOPIFY_CLIENT_SECRET || '',
    },
    appUrl: (env.APP_URL || '').replace(/\/$/, ''),
    dashboardPassword: env.DASHBOARD_PASSWORD || '',
    trackingSecret: env.TRACKING_SECRET || '',
    expressMatch: new RegExp(env.EXPRESS_SHIPPING_MATCH || 'express|noon', 'i'),
    codMatch: new RegExp(env.COD_GATEWAY_MATCH || 'cash on delivery|\\bcod\\b', 'i'),
    autoDispatch: /^(1|true|yes)$/i.test(env.AUTO_DISPATCH || ''),
  };
}

// Tags the app reads and writes on Shopify orders.
export const TAGS = {
  express: 'noon-express', // set by the app: order chose noon express delivery
  dispatch: 'noon-dispatch', // set by staff (or the dashboard): book a rider now
  dispatched: 'noon-dispatched', // set by the app once the noon task exists
  error: 'noon-error', // set by the app when booking failed; see the noon.error metafield
  delivered: 'noon-delivered',
  undelivered: 'noon-undelivered',
  cancelled: 'noon-cancelled',
};

export const METAFIELD_NAMESPACE = 'noon';
