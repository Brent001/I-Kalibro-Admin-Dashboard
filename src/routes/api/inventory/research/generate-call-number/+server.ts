/**
 * API endpoint for generating call numbers for research papers and theses
 * Endpoint: /api/research/generate-call-number
 * Method: POST
 *
 * researchType decides the prefix line on the spine label:
 *   thesis -> THS, dissertation -> DIS, capstone -> CAP, research -> RES
 * The prefix is returned in components.prefix and display.*, and it leads
 * shelfOrder so each type shelves together. callNumber itself stays in the
 * plain "DDC Cutter" format so parseCallNumber() keeps working on it.
 * For group work, authorLastName is the lead author.
 *
 * Example body:
 * {
 *   "researchType": "capstone",
 *   "title": "e-KALIBRO Smart Library Management System",
 *   "authorLastName": "Dela Cruz",
 *   "category": "Computer Science",
 *   "year": 2026
 * }
 */

import {
	createCallNumberHandler,
	checkInt,
	checkString,
	isBlank,
	type BaseRequest
} from '$lib/server/callNumberApi.js';

const PREFIXES = {
	thesis: 'THS',
	dissertation: 'DIS',
	capstone: 'CAP',
	research: 'RES'
} as const;

type ResearchType = keyof typeof PREFIXES;

interface ResearchRequest extends BaseRequest {
	// Required: title, authorLastName, year
	researchType?: ResearchType; // defaults to "thesis"
}

const typeOf = (body: ResearchRequest): ResearchType =>
	isBlank(body.researchType) ? 'thesis' : (body.researchType as ResearchType);

export const POST = createCallNumberHandler<ResearchRequest>({
	type: 'research',
	idKey: 'researchId',
	idPrefix: 'R',

	validate(body, errors) {
		checkString(body, 'title', errors, { required: true, max: 300 });
		checkString(body, 'authorLastName', errors, { required: true, max: 100 });
		checkInt(body, 'year', 1000, new Date().getFullYear() + 1, errors, { required: true });

		if (!isBlank(body.researchType) && !(String(body.researchType) in PREFIXES)) {
			errors.push({
				field: 'researchType',
				message: `researchType must be one of: ${Object.keys(PREFIXES).join(', ')}`
			});
		}
	},

	toMetadata: (body) => ({
		title: body.title!,
		authorLastName: body.authorLastName!,
		category: body.category,
		customDDC: body.customDDC,
		year: body.year,
		copy: body.copy
	}),

	prefix: (body) => PREFIXES[typeOf(body)],

	components: (body) => ({ researchType: typeOf(body) })
});