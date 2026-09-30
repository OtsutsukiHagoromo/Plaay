import { deps } from '../lib/deps.js';
import { handleShopifyWebhook } from '../lib/handlers.js';

export const POST = (request) => handleShopifyWebhook(request, deps());
