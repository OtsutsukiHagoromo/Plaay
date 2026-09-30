import { deps } from '../lib/deps.js';
import { handleTrackData } from '../lib/handlers.js';

export const GET = (request) => handleTrackData(request, deps());
