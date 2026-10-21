// Checks the Shopify connection and subscribes the app to the order webhooks it needs.

export const REQUIRED_SCOPES = [
  'read_orders',
  'write_orders',
  'read_merchant_managed_fulfillment_orders',
  'write_merchant_managed_fulfillment_orders',
];

export const WEBHOOK_TOPICS = ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED'];

export const webhookUri = (cfg) => `${cfg.appUrl}/api/shopify-webhook`;

// Never throws: returns { ok: false, error } when Shopify cannot be reached.
export async function getConnection(shopify, cfg) {
  try {
    const data = await shopify.graphql(`{
      shop { name myshopifyDomain }
      currentAppInstallation { app { title } accessScopes { handle } }
      webhookSubscriptions(first: 50) { nodes { topic uri } }
    }`);
    const scopes = data.currentAppInstallation.accessScopes.map((s) => s.handle);
    // write_X implies read_X.
    const has = (s) => scopes.includes(s) || scopes.includes(s.replace(/^read_/, 'write_'));
    const uri = webhookUri(cfg);
    const subscribed = data.webhookSubscriptions.nodes.filter((w) => w.uri === uri).map((w) => w.topic);
    return {
      ok: true,
      shop: data.shop.name,
      domain: data.shop.myshopifyDomain,
      app: data.currentAppInstallation.app.title,
      missingScopes: REQUIRED_SCOPES.filter((s) => !has(s)),
      missingWebhooks: WEBHOOK_TOPICS.filter((t) => !subscribed.includes(t)),
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function connectWebhooks(shopify, cfg) {
  if (!cfg.appUrl) throw new Error('APP_URL is not set');
  const status = await getConnection(shopify, cfg);
  if (!status.ok) throw new Error(status.error);
  const results = [];
  for (const topic of status.missingWebhooks) {
    const res = await shopify.graphql(
      `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) { webhookSubscription { id } userErrors { message } }
      }`,
      { topic, sub: { uri: webhookUri(cfg), format: 'JSON' } },
    );
    const errors = res.webhookSubscriptionCreate.userErrors;
    results.push({ topic, ok: !errors.length, error: errors.map((e) => e.message).join('; ') });
  }
  return results;
}
