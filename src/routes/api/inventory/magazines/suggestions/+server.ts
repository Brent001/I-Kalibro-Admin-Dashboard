import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requirePermission } from '$lib/server/db/auth.js';
import { suggestMagazines } from '$lib/server/services/metadataLookupService.js';

export const GET: RequestHandler = async ({ request, cookies, url }) => {
	const auth = await requirePermission(request, 'canManageBooks', cookies.get('token'));
	if ('error' in auth) return auth.error;

	const query = url.searchParams.get('q')?.trim() ?? '';
	if (query.length < 2) return json({ success: true, data: [] });

	try {
		const data = await suggestMagazines(query);
		return json({ success: true, data });
	} catch {
		return json({
			success: false,
			error: 'Magazine suggestions are temporarily unavailable',
			code: 'UPSTREAM'
		}, { status: 502 });
	}
};
