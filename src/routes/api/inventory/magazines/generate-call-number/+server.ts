/**
 * API endpoint for generating call numbers for magazines
 * Endpoint: /api/magazines/generate-call-number
 * Method: POST
 *
 * Magazines are catalogued as serials, shelved by title (main entry is the
 * first word of the title unless authorLastName is given), then year,
 * month, volume and issue.
 *
 * Example body:
 * {
 *   "title": "National Geographic",
 *   "category": "Geography",
 *   "year": 2024,
 *   "month": 3,
 *   "volume": 245,
 *   "issue": 3,
 *   "issn": "0027-9358"
 * }
 */

import {
	createCallNumberHandler,
	checkInt,
	checkString,
	copyIdPart,
	isBlank,
	isValidIssn,
	str,
	titleMainEntry,
	type BaseRequest
} from '$lib/server/callNumberApi.js';

interface MagazineRequest extends BaseRequest {
	// Required: title, year, and at least one of month, volume, issue
	issn?: string;
	publisher?: string;
	month?: number; // 1 to 12
	volume?: number;
	issue?: number;
}

const pad2 = (n: number | undefined) => String(n ?? 0).padStart(2, '0');

export const POST = createCallNumberHandler<MagazineRequest>({
	type: 'magazine',
	idKey: 'magazineId',
	idPrefix: 'M',

	validate(body, errors) {
		checkString(body, 'title', errors, { required: true, max: 300 });
		checkString(body, 'publisher', errors, { max: 200 });
		checkInt(body, 'year', 1000, new Date().getFullYear() + 1, errors, { required: true });
		checkInt(body, 'month', 1, 12, errors);
		checkInt(body, 'volume', 1, 9999, errors);
		checkInt(body, 'issue', 1, 999, errors);

		if (body.month === undefined && body.volume === undefined && body.issue === undefined) {
			errors.push({
				field: 'month',
				message: 'Provide at least one of month, volume or issue to identify the magazine issue'
			});
		}

		if (!isBlank(body.issn) && (typeof body.issn !== 'string' || !isValidIssn(body.issn))) {
			errors.push({ field: 'issn', message: 'ISSN must be valid, e.g. 0027-9358' });
		}
	},

	toMetadata: (body) => ({
		title: body.title!,
		authorLastName: body.authorLastName || titleMainEntry(body.title!),
		// Without a category the generator would return 000, so default to 050 (magazines)
		category: body.category || 'magazine',
		customDDC: body.customDDC,
		year: body.year,
		volume: body.volume,
		issue: body.issue,
		copy: body.copy,
		isSerial: true
	}),

	// The generator orders by year|volume|issue|copy. Month goes right after
	// year so monthly issues without a volume still sort correctly.
	shelfOrder: (body, base) => {
		const parts = base.split('|');
		parts.splice(5, 0, pad2(body.month));
		return parts.join('|');
	},

	// Month is not part of the generator's id, so add it
	idParts: (body) => [...(body.month ? [`M${pad2(body.month)}`] : []), ...copyIdPart(body)],

	components: (body) => ({ month: str(body.month) })
});