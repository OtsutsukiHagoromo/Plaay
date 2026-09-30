// Subscribes the app to the Shopify order webhooks it needs.
// Usage: node --env-file=.env scripts/register-webhooks.js

import { loadConfig } from '../lib/config.js';
import { createShopifyClient } from '../lib/shopify.js';

const cfg = loadConfig();
if (!cfg.appUrl) throw new Error('Set APP_URL first');
const shopify = createShopifyClient(cfg.shopify);
const uri = `${cfg.appUrl}/api/shopify-webhook`;

const existing = await shopify.graphql(`{ webhookSubscriptions(first: 50) { nodes { id topic uri } } }`);
for (const topic of ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED']) {
  if (existing.webhookSubscriptions.nodes.some((w) => w.topic === topic && w.uri === uri)) {
    console.log(`${topic}: already registered`);
    continue;
  }
  const res = await shopify.graphql(
    `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) { webhookSubscription { id } userErrors { message } }
    }`,
    { topic, sub: { uri, format: 'JSON' } },
  );
  const errors = res.webhookSubscriptionCreate.userErrors;
  console.log(`${topic}: ${errors.length ? errors.map((e) => e.message).join('; ') : 'registered'}`);
}
