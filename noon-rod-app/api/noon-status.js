import { deps } from '../lib/deps.js';
import { handleNoonStatus } from '../lib/handlers.js';

export const POST = (request) => handleNoonStatus(request, deps());
