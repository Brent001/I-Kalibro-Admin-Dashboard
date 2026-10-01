/**
 * GET /api/books/lookup?isbn=9780132350884
 * Optional: &cover=false to skip downloading and storing the cover
 *
 * Returns metadata named after the tbl_book columns. The cover is saved in
 * B2 and the object key comes back in data.coverImage.
 * This route calls outside services and writes to B2, so put it behind your
 * staff authentication.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { lookupBook, toHttpError } from '$lib/server/services/metadataLookupService.js';
import { requirePermission } from '$lib/server/db/auth.js';

export const GET: RequestHandler = async ({ request, cookies, url }) => {
	const auth = await requirePermission(request, 'canManageBooks', cookies.get('token'));
	if ('error' in auth) return auth.error;

	try {
		const data = await lookupBook(url.searchParams.get('isbn') ?? '', {
			saveCover: false
		});
		return json({ success: true, data });
	} catch (err) {
		const { status, body } = toHttpError(err);
		return json(body, { status });
	}
};