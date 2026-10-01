import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { verifyToken } from '$lib/server/db/auth.js';
import { subscribe } from '$lib/server/events/magazinesEvents.js';

export const GET: RequestHandler = async ({ cookies }) => {
  const user = await verifyToken(cookies.get('token') || '');
  if (!user || !['admin', 'super_admin', 'staff'].includes(user.userType)) throw error(401, 'Unauthorized');
  return subscribe();
};
