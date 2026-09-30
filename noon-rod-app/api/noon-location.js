import { deps } from '../lib/deps.js';
import { handleNoonLocation } from '../lib/handlers.js';

export const POST = (request) => handleNoonLocation(request, deps());
