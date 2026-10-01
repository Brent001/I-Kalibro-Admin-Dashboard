/**
 * API endpoint for generating call numbers for books
 * Endpoint: /api/books/generate-call-number
 * Method: POST
 *
 * Example body:
 * {
 *   "title": "Clean Code",
 *   "authorLastName": "Martin",
 *   "category": "Computer Science",
 *   "year": 2008,
 *   "edition": "1st ed.",
 *   "isbn": "978-0-13-235088-4",
 *   "copy": 2
 * }
 */

import {
	createCallNumberHandler,
	checkString,
	isBlank,
	isValidIsbn,
	str,
	type BaseRequest
} from '$lib/server/callNumberApi.js';

interface BookRequest extends BaseRequest {
	// Required: title, authorLastName (book is shelved by main author)
	isbn?: string;
	edition?: string | number;
	publisher?: string;
}

export const POST = createCallNumberHandler<BookRequest>({
	type: 'book',
	idKey: 'bookId',
	idPrefix: 'B',

	validate(body, errors) {
		checkString(body, 'title', errors, { required: true, max: 300 });
		checkString(body, 'authorLastName', errors, { required: true, max: 100 });
		checkString(body, 'publisher', errors, { max: 200 });

		if (!isBlank(body.isbn) && (typeof body.isbn !== 'string' || !isValidIsbn(body.isbn))) {
			errors.push({ field: 'isbn', message: 'ISBN must be a valid ISBN-10 or ISBN-13' });
		}

		if (!isBlank(body.edition)) {
			const ok =
				(typeof body.edition === 'string' && body.edition.length <= 50) ||
				(typeof body.edition === 'number' && Number.isInteger(body.edition) && body.edition > 0);
			if (!ok) {
				errors.push({
					field: 'edition',
					message: 'Edition must be a positive whole number or text up to 50 characters'
				});
			}
		}
	},

	toMetadata: (body) => ({
		title: body.title!,
		authorLastName: body.authorLastName!,
		category: body.category,
		customDDC: body.customDDC,
		year: body.year,
		edition: str(body.edition),
		copy: body.copy
	}),

	components: (body) => ({ edition: str(body.edition) })
});