/**
 * API endpoint for generating call numbers for journals
 * Endpoint: /api/journals/generate-call-number
 * Method: POST
 *
 * Supports:
 * - Serial/journal support with volume/issue
 * - Publication years
 * - Multiple copies
 * - Journal ids that include volume, issue, year and copy
 * - Shelf ordering by year, volume and issue
 *
 * Main entry is the first word of the title unless authorLastName is given.
 * Journals are serials by default. Send "isSerial": false to catalogue a
 * single standalone item without volume/issue.
 *
 * Example body:
 * {
 *   "title": "Philippine Journal of Science",
 *   "category": "Science",
 *   "year": 2024,
 *   "volume": 153,
 *   "issue": 2,
 *   "issn": "0031-7683"
 * }
 */

import {
	createCallNumberHandler,
	checkInt,
	checkString,
	copyIdPart,
	isBlank,
	isValidIssn,
	titleMainEntry,
	type BaseRequest
} from '$lib/server/callNumberApi.js';

interface JournalRequest extends BaseRequest {
	// Required: title, and a volume or an issue unless isSerial is false
	issn?: string;
	publisher?: string;
	isSerial?: boolean; // defaults to true
	volume?: number;
	issue?: number;
}

const isSerial = (body: JournalRequest) => body.isSerial !== false;

export const POST = createCallNumberHandler<JournalRequest>({
	type: 'journal',
	idKey: 'journalId',
	idPrefix: 'J',

	validate(body, errors) {
		checkString(body, 'title', errors, { required: true, max: 300 });
		checkString(body, 'publisher', errors, { max: 200 });
		checkInt(body, 'volume', 1, 9999, errors);
		checkInt(body, 'issue', 1, 999, errors);

		if (body.isSerial !== undefined && typeof body.isSerial !== 'boolean') {
			errors.push({ field: 'isSerial', message: 'isSerial must be true or false' });
		}

		// A serial issue cannot be told apart without a volume or an issue number
		if (isSerial(body) && body.volume === undefined && body.issue === undefined) {
			errors.push({
				field: 'volume',
				message: 'Serial journals need a volume or an issue number'
			});
		}

		if (!isBlank(body.issn) && (typeof body.issn !== 'string' || !isValidIssn(body.issn))) {
			errors.push({ field: 'issn', message: 'ISSN must be valid, e.g. 0031-7683' });
		}
	},

	toMetadata: (body) => ({
		title: body.title!,
		authorLastName: body.authorLastName || titleMainEntry(body.title!),
		// Without a category the generator would return 000, so default to 050 (serials)
		category: body.category || 'journal',
		customDDC: body.customDDC,
		year: body.year,
		volume: body.volume,
		issue: body.issue,
		copy: body.copy,
		isSerial: isSerial(body)
	}),

	// The generator already puts year, volume and issue in bookId and shelfOrder.
	// It leaves copy out of serial ids, so add it.
	idParts: (body) => copyIdPart(body)
});