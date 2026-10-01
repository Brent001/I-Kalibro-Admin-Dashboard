/**
 * Shared helpers for the call number API endpoints:
 * books, magazines, journals, research/thesis.
 *
 * Each route only declares what is different (validation, metadata mapping,
 * prefix, shelf suffix). Parsing, error handling, custom call numbers,
 * display formats and the response shape live here.
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import {
	generateCallNumber,
	isValidCallNumber,
	type BookMetadata
} from '$lib/utils/callNumberGenerator.js';
import { requirePermission } from '$lib/server/db/auth.js';

export type MaterialType = 'book' | 'magazine' | 'journal' | 'research';

export interface FieldError {
	field: string;
	message: string;
}

/** Fields shared by every material type */
export interface BaseRequest {
	title?: string;
	authorLastName?: string;
	category?: string;
	customDDC?: string;
	year?: number;
	copy?: number;
	customCallNumber?: string;
	[key: string]: unknown;
}

export interface CallNumberResponse {
	success: boolean;
	data?: {
		type: MaterialType;
		callNumber: string;
		shelfOrder: string;
		components: Record<string, string | undefined>;
		display: {
			full: string; // Multi-line, as it appears on the spine
			compact: string; // Single line for tables and lists
			label: string; // Trimmed lines for printing labels
		};
		[idKey: string]: unknown; // bookId, magazineId, journalId or researchId
	};
	error?: string;
	validationErrors?: FieldError[];
}

export interface HandlerConfig<T extends BaseRequest> {
	type: MaterialType;
	/** Name of the id field in the response, e.g. "bookId" */
	idKey: string;
	/** Prefix for the generated id, e.g. "B" */
	idPrefix: string;
	/** Add type specific validation errors */
	validate: (body: T, errors: FieldError[]) => void;
	/** Map the request to the generator input */
	toMetadata: (body: T) => BookMetadata;
	/** Optional line shown above the call number on labels, e.g. "THS" */
	prefix?: (body: T) => string | undefined;
	/** Optional tweak to the generator's shelfOrder, applied before the prefix */
	shelfOrder?: (body: T, base: string) => string;
	/** Extra id segments, e.g. ["V12", "I03"] */
	idParts?: (body: T) => string[];
	/** Extra components to return, e.g. volume and issue */
	components?: (body: T) => Record<string, string | undefined>;
}

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

export const isBlank = (v: unknown): boolean =>
	v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

export const str = (v: unknown): string | undefined =>
	v === undefined || v === null ? undefined : String(v);

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

export function fail(error: string, status: number, validationErrors?: FieldError[]) {
	const payload: CallNumberResponse = {
		success: false,
		error,
		...(validationErrors ? { validationErrors } : {})
	};
	return json(payload, { status });
}

/**
 * Main entry for items catalogued by title (magazines, journals).
 * Skips a leading article: "The Philippine Star" becomes "Philippine".
 */
export function titleMainEntry(title: string): string {
	const articles = new Set(['a', 'an', 'the', 'el', 'la', 'le', 'les', 'los', 'las', 'der', 'die', 'das']);
	const words = title.trim().split(/\s+/);
	const word = words.length > 1 && articles.has(words[0].toLowerCase()) ? words[1] : words[0] ?? '';
	return word.replace(/[^\p{L}\p{N}]/gu, '');
}

/** Copy segment for ids. The generator leaves copy out of serial ids. */
export function copyIdPart(body: BaseRequest): string[] {
	return typeof body.copy === 'number' && body.copy > 1 ? [`C${body.copy}`] : [];
}

export function isValidIssn(value: string): boolean {
	const s = value.replace('-', '').toUpperCase();
	if (!/^\d{7}[\dX]$/.test(s)) return false;
	let sum = 0;
	for (let i = 0; i < 7; i++) sum += Number(s[i]) * (8 - i);
	const check = (11 - (sum % 11)) % 11;
	return (check === 10 ? 'X' : String(check)) === s[7];
}

export function isValidIsbn(value: string): boolean {
	const s = value.replace(/[-\s]/g, '').toUpperCase();
	if (/^\d{13}$/.test(s)) {
		let sum = 0;
		for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
		return sum % 10 === 0;
	}
	if (/^\d{9}[\dX]$/.test(s)) {
		let sum = 0;
		for (let i = 0; i < 10; i++) sum += (s[i] === 'X' ? 10 : Number(s[i])) * (10 - i);
		return sum % 11 === 0;
	}
	return false;
}

/* ------------------------------------------------------------------ */
/* Validation helpers                                                  */
/* ------------------------------------------------------------------ */

export function checkString(
	body: BaseRequest,
	field: string,
	errors: FieldError[],
	opts: { required?: boolean; max?: number } = {}
): void {
	const { required = false, max = 200 } = opts;
	const value = body[field];

	if (isBlank(value)) {
		if (required) errors.push({ field, message: `${field} is required` });
		return;
	}
	if (typeof value !== 'string') {
		errors.push({ field, message: `${field} must be text` });
		return;
	}
	if (value.length > max) {
		errors.push({ field, message: `${field} must be at most ${max} characters` });
	}
}

export function checkInt(
	body: BaseRequest,
	field: string,
	min: number,
	max: number,
	errors: FieldError[],
	opts: { required?: boolean } = {}
): void {
	const value = body[field];

	if (value === undefined || value === null) {
		if (opts.required) errors.push({ field, message: `${field} is required` });
		return;
	}
	if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
		errors.push({
			field,
			message: `${field[0].toUpperCase()}${field.slice(1)} must be a whole number between ${min} and ${max}`
		});
	}
}

/** Checks shared by every material type */
function validateCommon(body: BaseRequest, errors: FieldError[]): void {
	const currentYear = new Date().getFullYear();

	checkString(body, 'title', errors, { max: 300 });
	checkString(body, 'authorLastName', errors, { max: 100 });
	checkString(body, 'category', errors, { max: 100 });
	checkInt(body, 'year', 1000, currentYear + 1, errors);
	checkInt(body, 'copy', 1, 99, errors);

	if (!isBlank(body.customDDC)) {
		if (typeof body.customDDC !== 'string' || !/^\d{1,3}(\.\d+)?$/.test(body.customDDC)) {
			errors.push({
				field: 'customDDC',
				message: 'Custom DDC must be in format: 123 or 123.45'
			});
		}
	}

	if (!isBlank(body.customCallNumber) && typeof body.customCallNumber !== 'string') {
		errors.push({ field: 'customCallNumber', message: 'customCallNumber must be text' });
	}
}

/* ------------------------------------------------------------------ */
/* Display formats                                                     */
/* ------------------------------------------------------------------ */

export function formatDisplays(full: string) {
	const lines = full
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean);

	return {
		full,
		compact: lines.join(' '),
		label: lines.join('\n')
	};
}

/* ------------------------------------------------------------------ */
/* Handler factory                                                     */
/* ------------------------------------------------------------------ */

export function createCallNumberHandler<T extends BaseRequest>(cfg: HandlerConfig<T>): RequestHandler {
	return async ({ request, cookies }) => {
		const auth = await requirePermission(request, 'canManageBooks', cookies.get('token'));
		if ('error' in auth) return auth.error;

		// Parse body
		let body: T;
		try {
			const parsed: unknown = await request.json();
			if (!isRecord(parsed)) return fail('Request body must be a JSON object', 400);
			body = parsed as T;
		} catch {
			return fail('Invalid JSON body', 400);
		}

		// Validate
		const errors: FieldError[] = [];
		validateCommon(body, errors);
		cfg.validate(body, errors);
		if (errors.length > 0) return fail('Validation failed', 400, errors);

		try {
			// Custom call number override
			if (typeof body.customCallNumber === 'string' && body.customCallNumber.trim().length > 0) {
				const custom = body.customCallNumber.trim();

				if (!isValidCallNumber(custom)) {
					return fail(
						'Invalid custom call number format. Expected format: "123 A456" or "123.45 A456"',
						400
					);
				}

				const [ddc = '', cutter = ''] = custom.split(/\s+/);
				const response: CallNumberResponse = {
					success: true,
					data: {
						type: cfg.type,
						[cfg.idKey]: `custom-${Date.now()}`,
						callNumber: custom,
						shelfOrder: custom.replace(/\s+/g, '-'),
						components: { ddc, cutter },
						display: formatDisplays(custom)
					}
				};
				return json(response);
			}

			// Generate
			const result = generateCallNumber(cfg.toMetadata(body));

			const prefix = cfg.prefix?.(body);
			const adjusted = cfg.shelfOrder ? cfg.shelfOrder(body, result.shelfOrder) : result.shelfOrder;
			const shelfOrder = prefix ? `${prefix}|${adjusted}` : adjusted;
			const labelText = prefix ? `${prefix}\n${result.full}` : result.full;

			// The generator's bookId already carries volume, issue and year for serials
			const id = [`${cfg.idPrefix}-${result.bookId}`, ...(cfg.idParts?.(body) ?? [])].join('.');

			const response: CallNumberResponse = {
				success: true,
				data: {
					type: cfg.type,
					[cfg.idKey]: id,
					// Kept free of the prefix so parseCallNumber() still works on it
					callNumber: result.full,
					shelfOrder,
					components: {
						...result.components,
						prefix,
						...cfg.components?.(body)
					},
					display: formatDisplays(labelText)
				}
			};
			return json(response);
		} catch (err) {
			// Log the detail, but do not leak internals to the client
			console.error(`Error generating ${cfg.type} call number:`, err);
			return fail('Internal server error', 500);
		}
	};
}