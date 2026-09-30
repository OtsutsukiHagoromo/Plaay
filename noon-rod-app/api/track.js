import { deps } from '../lib/deps.js';
import { handleTrackPage } from '../lib/handlers.js';

export const GET = (request) => handleTrackPage(request, deps());
