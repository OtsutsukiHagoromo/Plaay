import { deps } from '../lib/deps.js';
import { handleExpressCheck } from '../lib/handlers.js';

export const GET = (request) => handleExpressCheck(request, deps());
export const OPTIONS = (request) => handleExpressCheck(request, deps());
