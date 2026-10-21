// Subscribes the app to the Shopify order webhooks it needs (same as the dashboard's Connect Shopify button).
// Usage: node --env-file=.env scripts/register-webhooks.js

import { loadConfig } from '../lib/config.js';
import { connectWebhooks, getConnection } from '../lib/setup.js';
import { createShopifyClient } from '../lib/shopify.js';

const cfg = loadConfig();
const shopify = createShopifyClient(cfg.shopify);

for (const r of await connectWebhooks(shopify, cfg)) console.log(`${r.topic}: ${r.ok ? 'registered' : r.error}`);
console.log(await getConnection(shopify, cfg));
