// One set of clients per warm function instance (keeps the Shopify token cached between calls).

import { loadConfig } from './config.js';
import { createNoonClient } from './noon.js';
import { createShopifyClient } from './shopify.js';

let cached;

export function deps() {
  if (!cached) {
    const cfg = loadConfig();
    cached = {
      cfg,
      noon: createNoonClient(cfg.noon),
      shopify: createShopifyClient(cfg.shopify),
      log: console,
    };
  }
  return cached;
}
