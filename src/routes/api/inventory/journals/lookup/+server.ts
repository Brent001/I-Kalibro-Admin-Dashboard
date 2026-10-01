/**
 * GET /api/journals/lookup?issn=0031-7683
 * GET /api/journals/lookup?doi=10.1000/xyz123
 *
 * An ISSN returns the journal title, publisher and subjects.
 * A DOI also returns volume, issueNumber and publishedDate of that article.
 * Journals have no free cover source, so coverImage is always null.
 * This route calls outside services, so put it behind your staff
 * authentication.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { lookupJournal, toHttpError } from '$lib/server/services/metadataLookupService.js';
import { requirePermission } from '$lib/server/db/auth.js';

export const GET: RequestHandler = async ({ request, cookies, url }) => {
	const auth = await requirePermission(request, 'canManageBooks', cookies.get('token'));
	if ('error' in auth) return auth.error;

	try {
		const data = await lookupJournal({
			issn: url.searchParams.get('issn') ?? undefined,
			doi: url.searchParams.get('doi') ?? undefined
		});
		return json({ success: true, data });
	} catch (err) {
		const { status, body } = toHttpError(err);
		return json(body, { status });
	}
};