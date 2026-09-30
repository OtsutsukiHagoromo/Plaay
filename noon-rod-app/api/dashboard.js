import { deps } from '../lib/deps.js';
import { handleDashboard } from '../lib/handlers.js';

export const GET = (request) => handleDashboard(request, deps());
export const POST = (request) => handleDashboard(request, deps());
