/**
 * GET /api/magazines/lookup?title=National%20Geographic
 * GET /api/magazines/lookup?issn=0027-9358
 * Optional: &cover=false to skip downloading and storing the cover
 *
 * Returns metadata named after the tbl_magazine columns. issueNumber, volume
 * and publishedDate are always null because they belong to one issue and no
 * free source knows which issue the library holds. The cover comes from the
 * best matching Google Books record, so it may show a different issue.
 * This route calls outside services and writes to B2, so put it behind your
 * staff authentication.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { lookupMagazine, toHttpError } from '$lib/server/services/metadataLookupService.js';
import { requirePermission } from '$lib/server/db/auth.js';

export const GET: RequestHandler = async ({ request, cookies, url }) => {
	const auth = await requirePermission(request, 'canManageBooks', cookies.get('token'));
	if ('error' in auth) return auth.error;

	try {
		const data = await lookupMagazine(
			{
				title: url.searchParams.get('title') ?? undefined,
				issn: url.searchParams.get('issn') ?? undefined
			},
			{ saveCover: false }
		);
		return json({ success: true, data });
	} catch (err) {
		const { status, body } = toHttpError(err);
		return json(body, { status });
	}
};