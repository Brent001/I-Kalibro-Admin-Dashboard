/**
 * Metadata lookup service
 *
 * Books      Open Library + Google Books, merged, by ISBN
 * Journals   Crossref, by ISSN or DOI
 * Magazines  Google Books (printType=magazines) by title, Crossref by ISSN
 *
 * Results use the same names as the tbl_book, tbl_magazine and tbl_journal
 * columns, so a form can be filled straight from them. Covers are saved in
 * Backblaze B2 and the object key is returned in coverImage.
 *
 * Research and thesis items are in house, so they have no lookup.
 *
 * Environment variables:
 *   LOOKUP_CONTACT_EMAIL   recommended, used for Crossref's polite pool
 *   GOOGLE_BOOKS_API_KEY   optional, gives Google Books a stable quota
 */

import { env } from '$env/dynamic/private';
import { getDeweyDecimal } from '$lib/utils/callNumberGenerator.js';
import { isValidIsbn, isValidIssn } from '$lib/server/callNumberApi.js';
import {
	getCoverUrl,
	saveCoverFromCandidates,
	slugify,
	type CoverResult,
	type CoverStatus
} from './coverStorageService.js';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export class LookupError extends Error {
	code: 'INVALID_INPUT' | 'NOT_FOUND' | 'UPSTREAM';
	status: number;

	constructor(code: LookupError['code'], message: string, status: number) {
		super(message);
		this.name = 'LookupError';
		this.code = code;
		this.status = status;
	}
}

export interface LookupOptions {
	/** Set to false to skip downloading and storing the cover */
	saveCover?: boolean;
}

interface CoverFields {
	/** B2 object key. Save this in the coverImage column. */
	coverImage: string | null;
	/** URL the browser can load, built from the key */
	coverUrl: string | null;
	coverStatus: CoverStatus;
}

interface CategoryHint {
	/** Subject text that matched a key in DEWEY_DECIMAL_MAP, or null */
	suggestedCategory: string | null;
	suggestedDDC: string | null;
}

export interface BookLookupResult extends CoverFields, CategoryHint {
	sources: string[];
	isbn: string; // always ISBN-13
	title: string;
	author: string | null;
	publisher: string | null;
	publishedYear: number | null;
	edition: string | null; // no free source gives this, enter it by hand
	language: string | null;
	pages: number | null;
	description: string | null;
	subjects: string[];
}

export interface JournalLookupResult extends CoverFields, CategoryHint {
	sources: string[];
	title: string;
	publisher: string | null;
	issn: string | null;
	volume: string | null; // only filled when a DOI is given
	issueNumber: string | null; // only filled when a DOI is given
	publishedDate: string | null; // YYYY-MM-DD, only filled when a DOI is given
	language: string | null;
	description: string | null;
	subjects: string[];
}

export interface MagazineLookupResult extends CoverFields, CategoryHint {
	sources: string[];
	title: string;
	publisher: string | null;
	issn: string | null;
	issueNumber: null; // issue specific, always entered by hand
	volume: null; // issue specific, always entered by hand
	publishedDate: null; // issue specific, always entered by hand
	language: string | null;
	description: string | null;
	subjects: string[];
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export function toHttpError(err: unknown): {
	status: number;
	body: { success: false; error: string; code: string };
} {
	if (err instanceof LookupError) {
		return { status: err.status, body: { success: false, error: err.message, code: err.code } };
	}
	console.error('Unexpected lookup error:', err);
	return { status: 500, body: { success: false, error: 'Internal server error', code: 'INTERNAL' } };
}

const userAgent = () =>
	env.LOOKUP_CONTACT_EMAIL
		? `MDC-Library/1.0 (mailto:${env.LOOKUP_CONTACT_EMAIL})`
		: 'MDC-Library/1.0';

async function getJson<T>(url: string): Promise<T | null> {
	const res = await fetch(url, {
		headers: { 'User-Agent': userAgent(), Accept: 'application/json' },
		signal: AbortSignal.timeout(8000)
	});
	if (res.status === 404) return null;
	if (!res.ok) {
		throw new LookupError('UPSTREAM', `${new URL(url).hostname} returned ${res.status}`, 502);
	}
	return (await res.json()) as T;
}

const clip = (value: string | null | undefined, max: number): string | null => {
	const s = value?.replace(/\s+/g, ' ').trim();
	return s ? s.slice(0, max).trim() : null;
};

const unique = (items: string[]): string[] => [...new Set(items.map((i) => i.trim()).filter(Boolean))];

const stripHtml = (value?: string): string | null =>
	clip(value?.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '), 5000);

const toYear = (value?: string): number | null => {
	const m = value?.match(/\b(1\d{3}|20\d{2})\b/);
	return m ? Number(m[1]) : null;
};

const languageName = (code?: string | null): string | null => {
	if (!code) return null;
	try {
		return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? null;
	} catch {
		return null;
	}
};

/** "2024", "2024-03" or "2024-03-15" -> "YYYY-MM-DD" */
function toIsoDate(parts: (number | string | null | undefined)[]): string | null {
	const [y, m, d] = parts;
	if (!y) return null;
	const pad = (v: number | string | null | undefined, fallback: string) =>
		v ? String(v).padStart(2, '0') : fallback;
	return `${y}-${pad(m, '01')}-${pad(d, '01')}`;
}

function suggestCategory(subjects: string[]): CategoryHint {
	for (const subject of subjects) {
		const ddc = getDeweyDecimal(subject, '');
		if (ddc) return { suggestedCategory: subject, suggestedDDC: ddc };
	}
	return { suggestedCategory: null, suggestedDDC: null };
}

async function resolveCover(
	kind: 'books' | 'magazines',
	id: string,
	urls: string[],
	opts: LookupOptions
): Promise<CoverFields> {
	if (opts.saveCover === false) {
		return { coverImage: null, coverUrl: urls[0] ?? null, coverStatus: 'skipped' };
	}
	const result: CoverResult = await saveCoverFromCandidates(kind, id, urls);
	return { coverImage: result.key, coverUrl: getCoverUrl(result.key), coverStatus: result.status };
}

/* ------------------------------------------------------------------ */
/* Identifier handling                                                 */
/* ------------------------------------------------------------------ */

function isbn10To13(isbn10: string): string {
	const base = `978${isbn10.slice(0, 9)}`;
	let sum = 0;
	for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
	return `${base}${(10 - (sum % 10)) % 10}`;
}

function normalizeIsbn(raw: string): { isbn13: string; original: string } | null {
	const original = raw.replace(/[-\s]/g, '').toUpperCase();
	if (!isValidIsbn(original)) return null;
	return { isbn13: original.length === 10 ? isbn10To13(original) : original, original };
}

function normalizeIssn(raw: string): string | null {
	const s = raw.replace(/[^0-9xX]/g, '').toUpperCase();
	if (s.length !== 8) return null;
	const formatted = `${s.slice(0, 4)}-${s.slice(4)}`;
	return isValidIssn(formatted) ? formatted : null;
}

function normalizeDoi(raw: string): string | null {
	const doi = raw
		.trim()
		.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
		.replace(/^doi:/i, '');
	return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : null;
}

/* ------------------------------------------------------------------ */
/* Google Books                                                        */
/* ------------------------------------------------------------------ */

interface GoogleVolume {
	id: string;
	volumeInfo?: {
		title?: string;
		subtitle?: string;
		authors?: string[];
		publisher?: string;
		publishedDate?: string;
		description?: string;
		pageCount?: number;
		categories?: string[];
		language?: string;
		imageLinks?: { thumbnail?: string; smallThumbnail?: string };
		industryIdentifiers?: { type: string; identifier: string }[];
	};
}

async function googleSearch(q: string, extra: Record<string, string> = {}): Promise<GoogleVolume[]> {
	const params = new URLSearchParams({ q, maxResults: '5', ...extra });
	if (env.GOOGLE_BOOKS_API_KEY) params.set('key', env.GOOGLE_BOOKS_API_KEY);
	const data = await getJson<{ items?: GoogleVolume[] }>(
		`https://www.googleapis.com/books/v1/volumes?${params}`
	);
	return data?.items ?? [];
}

export interface MagazineSuggestion {
	id: string;
	title: string;
	publisher: string | null;
}

export async function suggestMagazines(rawQuery: string): Promise<MagazineSuggestion[]> {
	const query = rawQuery.trim();
	if (query.length < 2) return [];

	const seen = new Set<string>();
	const suggestions: MagazineSuggestion[] = [];
	const addSuggestion = (suggestion: MagazineSuggestion): void => {
		const key = suggestion.title.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		suggestions.push(suggestion);
	};

	try {
		const volumes = await googleSearch(`intitle:"${query}"`, { printType: 'magazines', maxResults: '8' });
		for (const volume of volumes) {
			const title = clip(volume.volumeInfo?.title, 200);
			if (!title) continue;
			const suggestion = {
				id: volume.id,
				title,
				publisher: clip(volume.volumeInfo?.publisher, 100)
			};
			addSuggestion(suggestion);
		}
	} catch {
		// Google Books is optional and may be rate-limited without an API key.
	}

	if (suggestions.length > 0) return suggestions;

	const data = await getJson<{ docs?: OpenLibrarySearchDoc[] }>(
		`https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=8`
	);
	for (const [index, book] of (data?.docs ?? []).entries()) {
		const title = clip(book.title, 200);
		if (!title || seen.has(title.toLowerCase())) continue;
		addSuggestion({
			id: `openlibrary-${index}-${title}`,
			title,
			publisher: clip(book.publisher?.[0], 100)
		});
	}

	return suggestions;
}

/** https version of the thumbnail without the page curl effect */
function googleCoverUrl(volume?: GoogleVolume): string | null {
	const links = volume?.volumeInfo?.imageLinks;
	const url = links?.thumbnail ?? links?.smallThumbnail;
	return url ? url.replace(/^http:\/\//i, 'https://').replace(/&edge=curl/g, '') : null;
}

const fullTitle = (title?: string, subtitle?: string) =>
	title ? (subtitle ? `${title}: ${subtitle}` : title) : undefined;

/* ------------------------------------------------------------------ */
/* Books                                                               */
/* ------------------------------------------------------------------ */

interface OpenLibrarySearchDoc {
	title?: string;
	subtitle?: string;
	author_name?: string[];
	publisher?: string[];
	first_publish_year?: number;
	number_of_pages_median?: number;
	subject?: string[];
	cover_i?: number;
	issn?: string[];
	description?: string;
}

interface OpenLibraryEdition {
	publishers?: string[];
	publish_date?: string;
	number_of_pages?: number;
	description?: string | { value?: string };
	subjects?: string[];
}

async function fromOpenLibrary(isbns: string[]) {
	const isbn = unique(isbns)[0];
	const [searchResult, editionResult] = await Promise.allSettled([
		getJson<{ numFound?: number; docs?: OpenLibrarySearchDoc[] }>(
			`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=1`
		),
		getJson<OpenLibraryEdition>(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`)
	]);
	const data = searchResult.status === 'fulfilled' ? searchResult.value : null;
	const edition = editionResult.status === 'fulfilled' ? editionResult.value : null;
	const book = data?.docs?.[0];
	if (!book && !edition) return null;
	const description = edition?.description;

	return {
		title: fullTitle(book?.title, book?.subtitle),
		author: book?.author_name?.join(', '),
		publisher: book?.publisher?.[0] ?? edition?.publishers?.[0],
		publishedYear: book?.first_publish_year ?? toYear(edition?.publish_date),
		pages: book?.number_of_pages_median ?? edition?.number_of_pages,
		description: typeof description === 'string' ? description : description?.value ?? null,
		subjects: [...(book?.subject ?? []), ...(edition?.subjects ?? [])]
	};
}

async function fromGoogleBooks(isbn: string) {
	const [volume] = await googleSearch(`isbn:${isbn}`, { maxResults: '1' });
	const info = volume?.volumeInfo;
	if (!info) return null;

	return {
		title: fullTitle(info.title, info.subtitle),
		author: info.authors?.join(', '),
		publisher: info.publisher,
		publishedYear: toYear(info.publishedDate),
		pages: info.pageCount,
		language: languageName(info.language),
		description: stripHtml(info.description),
		subjects: info.categories ?? [],
		coverUrl: googleCoverUrl(volume)
	};
}

export async function lookupBook(rawIsbn: string, opts: LookupOptions = {}): Promise<BookLookupResult> {
	const ids = normalizeIsbn(rawIsbn ?? '');
	if (!ids) throw new LookupError('INVALID_INPUT', 'ISBN must be a valid ISBN-10 or ISBN-13', 400);

	const [olResult, gbResult] = await Promise.allSettled([
		fromOpenLibrary([ids.isbn13, ids.original]),
		fromGoogleBooks(ids.isbn13)
	]);
	const ol = olResult.status === 'fulfilled' ? olResult.value : null;
	const gb = gbResult.status === 'fulfilled' ? gbResult.value : null;

	const title = ol?.title ?? gb?.title;
	if (!title) {
		if (olResult.status === 'rejected' || gbResult.status === 'rejected') {
			throw new LookupError('UPSTREAM', 'Book metadata providers are unavailable, try again shortly', 502);
		}
		throw new LookupError('NOT_FOUND', `No metadata found for ISBN ${ids.isbn13}`, 404);
	}

	const subjects = unique([...(ol?.subjects ?? []), ...(gb?.subjects ?? [])]).slice(0, 15);

	// Open Library covers come first. default=false makes a missing cover a 404
	const coverUrls = [`https://covers.openlibrary.org/b/isbn/${ids.isbn13}-L.jpg?default=false`];
	if (gb?.coverUrl) coverUrls.push(gb.coverUrl);

	return {
		sources: [ol && 'openlibrary', gb && 'googlebooks'].filter(Boolean) as string[],
		isbn: ids.isbn13,
		title: clip(title, 200) as string,
		author: clip(ol?.author ?? gb?.author, 200),
		publisher: clip(ol?.publisher ?? gb?.publisher, 100),
		publishedYear: ol?.publishedYear ?? gb?.publishedYear ?? null,
		edition: null,
		language: clip(gb?.language, 50),
		pages: ol?.pages ?? gb?.pages ?? null,
		description: gb?.description ?? clip(ol?.description, 5000),
		subjects,
		...suggestCategory(subjects),
		...(await resolveCover('books', ids.isbn13, coverUrls, opts))
	};
}

/* ------------------------------------------------------------------ */
/* Crossref (journals, and the ISSN path for magazines)                */
/* ------------------------------------------------------------------ */

const crossrefUrl = (path: string) =>
	`https://api.crossref.org${path}${
		env.LOOKUP_CONTACT_EMAIL ? `?mailto=${encodeURIComponent(env.LOOKUP_CONTACT_EMAIL)}` : ''
	}`;

interface CrossrefJournal {
	title?: string;
	publisher?: string;
	ISSN?: string[];
	subjects?: { name: string }[];
}

interface CrossrefWork {
	'container-title'?: string[];
	publisher?: string;
	ISSN?: string[];
	volume?: string;
	issue?: string;
	issued?: { 'date-parts'?: (number | null)[][] };
	language?: string;
	subject?: string[];
}

async function crossrefJournal(issn: string) {
	const data = await getJson<{ message?: CrossrefJournal }>(crossrefUrl(`/journals/${issn}`));
	const j = data?.message;
	if (!j?.title) return null;
	return {
		title: j.title,
		publisher: j.publisher,
		issn: j.ISSN?.[0] ?? issn,
		subjects: (j.subjects ?? []).map((s) => s.name)
	};
}

async function crossrefWork(doi: string) {
	const data = await getJson<{ message?: CrossrefWork }>(crossrefUrl(`/works/${encodeURI(doi)}`));
	const w = data?.message;
	const title = w?.['container-title']?.[0];
	if (!w || !title) return null;
	return {
		title,
		publisher: w.publisher,
		issn: w.ISSN?.[0] ?? null,
		volume: w.volume,
		issue: w.issue,
		publishedDate: toIsoDate(w.issued?.['date-parts']?.[0] ?? []),
		language: languageName(w.language),
		subjects: w.subject ?? []
	};
}

export async function lookupJournal(input: { issn?: string; doi?: string }): Promise<JournalLookupResult> {
	const rawIssn = input.issn?.trim();
	const rawDoi = input.doi?.trim();
	if (!rawIssn && !rawDoi) {
		throw new LookupError('INVALID_INPUT', 'Provide an issn or a doi', 400);
	}

	const issn = rawIssn ? normalizeIssn(rawIssn) : null;
	if (rawIssn && !issn) throw new LookupError('INVALID_INPUT', 'ISSN is not valid, e.g. 0031-7683', 400);
	const doi = rawDoi ? normalizeDoi(rawDoi) : null;
	if (rawDoi && !doi) throw new LookupError('INVALID_INPUT', 'DOI is not valid, e.g. 10.1000/xyz123', 400);

	// A DOI gives volume, issue and date. An ISSN only describes the journal.
	if (doi) {
		const work = await crossrefWork(doi);
		if (!work) throw new LookupError('NOT_FOUND', 'No journal article found for this DOI', 404);
		const subjects = unique(work.subjects).slice(0, 15);
		return {
			sources: ['crossref'],
			title: clip(work.title, 200) as string,
			publisher: clip(work.publisher, 100),
			issn: issn ?? work.issn,
			volume: clip(work.volume, 50),
			issueNumber: clip(work.issue, 50),
			publishedDate: work.publishedDate,
			language: clip(work.language, 50),
			description: null,
			subjects,
			...suggestCategory(subjects),
			coverImage: null,
			coverUrl: null,
			coverStatus: 'not_available'
		};
	}

	const journal = await crossrefJournal(issn as string);
	if (!journal) throw new LookupError('NOT_FOUND', `No journal found for ISSN ${issn}`, 404);
	const subjects = unique(journal.subjects).slice(0, 15);
	return {
		sources: ['crossref'],
		title: clip(journal.title, 200) as string,
		publisher: clip(journal.publisher, 100),
		issn: journal.issn,
		volume: null,
		issueNumber: null,
		publishedDate: null,
		language: null,
		description: null,
		subjects,
		...suggestCategory(subjects),
		coverImage: null,
		coverUrl: null,
		coverStatus: 'not_available'
	};
}

/* ------------------------------------------------------------------ */
/* Magazines                                                           */
/* ------------------------------------------------------------------ */

const normTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Prefers an exact title match, then a title that starts with the search */
function pickMagazine(volumes: GoogleVolume[], title: string): GoogleVolume | undefined {
	const wanted = normTitle(title);
	return (
		volumes.find((v) => normTitle(v.volumeInfo?.title ?? '') === wanted) ??
		volumes.find((v) => normTitle(v.volumeInfo?.title ?? '').startsWith(wanted)) ??
		volumes[0]
	);
}

async function fromOpenLibraryMagazine(title: string) {
	const data = await getJson<{ docs?: OpenLibrarySearchDoc[] }>(
		`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=8`
	);
	const wanted = normTitle(title);
	const docs = data?.docs ?? [];
	const match = docs.find((doc) => normTitle(doc.title ?? '') === wanted)
		?? docs.find((doc) => normTitle(doc.title ?? '').startsWith(wanted))
		?? docs[0];
	if (!match?.title) return null;

	return {
		title: match.title,
		publisher: match.publisher?.[0],
		subjects: match.subject ?? [],
		issn: match.issn?.map(normalizeIssn).find(Boolean) ?? null,
		description: match.description,
		coverUrl: match.cover_i
			? `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg?default=false`
			: null
	};
}

export async function lookupMagazine(
	input: { title?: string; issn?: string },
	opts: LookupOptions = {}
): Promise<MagazineLookupResult> {
	const rawTitle = input.title?.trim();
	const rawIssn = input.issn?.trim();
	if (!rawTitle && !rawIssn) throw new LookupError('INVALID_INPUT', 'Provide a title or an issn', 400);

	const issn = rawIssn ? normalizeIssn(rawIssn) : null;
	if (rawIssn && !issn) throw new LookupError('INVALID_INPUT', 'ISSN is not valid, e.g. 0028-792X', 400);

	// Crossref can name a magazine from its ISSN, when the publisher registers there
	let crossref: Awaited<ReturnType<typeof crossrefJournal>> = null;
	if (issn) {
		try {
			crossref = await crossrefJournal(issn);
		} catch {
			crossref = null;
		}
	}

	const searchTitle = rawTitle || crossref?.title;
	if (!searchTitle) throw new LookupError('NOT_FOUND', `No magazine found for ISSN ${issn}`, 404);

	let volumes: GoogleVolume[] = [];
	try {
		volumes = await googleSearch(`intitle:"${searchTitle}"`, { printType: 'magazines' });
	} catch (err) {
		if (!crossref) throw err instanceof LookupError ? err : new LookupError('UPSTREAM', 'Google Books is unavailable', 502);
	}

	const match = pickMagazine(volumes, searchTitle);
	const info = match?.volumeInfo;
	let openLibrary: Awaited<ReturnType<typeof fromOpenLibraryMagazine>> = null;
	if (!info) {
		try {
			openLibrary = await fromOpenLibraryMagazine(searchTitle);
		} catch {
			openLibrary = null;
		}
	}
	if (!info && !crossref && !openLibrary) {
		throw new LookupError('NOT_FOUND', `No magazine found for "${searchTitle}"`, 404);
	}

	const subjects = unique([
		...(crossref?.subjects ?? []),
		...(info?.categories ?? []),
		...(openLibrary?.subjects ?? [])
	]).slice(0, 15);
	const googleIssn = info?.industryIdentifiers?.find((i) => i.type === 'ISSN')?.identifier;
	const providerCoverUrl = googleCoverUrl(match) ?? openLibrary?.coverUrl ?? null;

	// One cover per matched provider record, so different titles never share a key
	const cover: CoverFields = providerCoverUrl
		? await resolveCover('magazines', `${slugify(searchTitle)}-${match?.id ?? 'openlibrary'}`, [providerCoverUrl], opts)
		: { coverImage: null, coverUrl: null, coverStatus: opts.saveCover === false ? 'skipped' : 'not_found' };

	return {
		sources: [info && 'googlebooks', openLibrary && 'openlibrary', crossref && 'crossref'].filter(Boolean) as string[],
		title: clip(info?.title ?? openLibrary?.title ?? crossref?.title ?? searchTitle, 200) as string,
		publisher: clip(info?.publisher ?? openLibrary?.publisher ?? crossref?.publisher, 100),
		issn: issn ?? crossref?.issn ?? (googleIssn ? normalizeIssn(googleIssn) : null) ?? openLibrary?.issn ?? null,
		issueNumber: null,
		volume: null,
		publishedDate: null,
		language: clip(languageName(info?.language), 50),
		description: stripHtml(info?.description) ?? clip(openLibrary?.description, 5000),
		subjects,
		...suggestCategory(subjects),
		...cover
	};
}