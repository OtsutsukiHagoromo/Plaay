import { deps } from '../lib/deps.js';
import { handleCheckoutRates } from '../lib/handlers.js';

export const POST = (request) => handleCheckoutRates(request, deps());
