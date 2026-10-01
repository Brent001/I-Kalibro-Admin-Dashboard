import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { getBulkAddAccess } from '$lib/server/utils/bulkAddAccess.js';

export const load: PageServerLoad = async ({ cookies }) => {
    const access = await getBulkAddAccess(cookies.get('token'));
    if (!access.user) throw redirect(302, '/');
    if (!access.authorized) throw redirect(302, '/dashboard/inventory/research');
    return { bulkAddEnabled: true };
};