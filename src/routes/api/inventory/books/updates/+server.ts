import type { RequestHandler } from '../$types.js';
import { subscribe } from '$lib/server/events/booksEvents.js';

export const GET: RequestHandler = async () => {
  // Returns an SSE stream
  return subscribe();
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS' } });
};
