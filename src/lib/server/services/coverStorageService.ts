/**
 * Cover storage service (Backblaze B2 through its S3 compatible API)
 *
 * Downloads a cover image from an approved host, checks that it really is an
 * image, and saves it in your own B2 bucket. The database should store the
 * returned object key (for example "covers/books/9780132350884.jpg") in the
 * coverImage column. Nothing is hotlinked from Open Library or Google.
 *
 * Uses the existing VITE_BACKBLAZE_* configuration and serves stored keys
 * through /api/images/cover/[fileName].
 */

import {
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';

export type CoverKind = 'books' | 'magazines' | 'journals';

export type CoverStatus =
	| 'stored' // downloaded and saved to B2 just now
	| 'exists' // already in B2, nothing downloaded
	| 'not_found' // no provider had a usable cover
	| 'skipped' // caller sent cover=false
	| 'not_available' // this item type has no cover source
	| 'storage_not_configured' // B2 env vars are missing
	| 'error';

export interface CoverResult {
	key: string | null;
	status: CoverStatus;
}

const MAX_BYTES = 5 * 1024 * 1024; // reject anything above 5 MB
const MIN_BYTES = 1024; // anything smaller is a placeholder, not a cover
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;
const USER_AGENT = 'MDC-Library/1.0';

/** Only these hosts may be contacted when downloading a cover (SSRF guard) */
const ALLOWED_HOSTS = new Set([
	'covers.openlibrary.org',
	'openlibrary.org',
	'archive.org',
	'books.google.com',
	'books.googleusercontent.com'
]);
const ALLOWED_SUFFIXES = ['.archive.org', '.googleusercontent.com'];

const KEY_PATTERN = /^covers\/(books|magazines|journals)\/[a-z0-9-]+\.(jpg|png|webp|gif)$/;

const storageConfig = () => {
	const region = process.env.VITE_BACKBLAZE_REGION || import.meta.env.VITE_BACKBLAZE_REGION || 'us-east-005';
	const endpoint = `https://s3.${region}.backblazeb2.com`;
	return {
		keyId: process.env.VITE_BACKBLAZE_KEY_ID || import.meta.env.VITE_BACKBLAZE_KEY_ID || '',
		appKey: process.env.VITE_BACKBLAZE_APPLICATION_KEY || import.meta.env.VITE_BACKBLAZE_APPLICATION_KEY || '',
		bucket: process.env.VITE_BACKBLAZE_BUCKET_NAME || import.meta.env.VITE_BACKBLAZE_BUCKET_NAME || 'E-kalibro',
		endpoint,
		region
	};
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

export function isCoverStorageConfigured(): boolean {
	const config = storageConfig();
	return Boolean(config.keyId && config.appKey && config.bucket);
}

let client: S3Client | null = null;

function getClient(): S3Client {
	if (client) return client;

	const config = storageConfig();

	client = new S3Client({
		endpoint: config.endpoint,
		region: config.region,
		credentials: {
			accessKeyId: config.keyId,
			secretAccessKey: config.appKey
		},
		// Backblaze rejects the newer default AWS SDK checksum headers
		requestChecksumCalculation: 'WHEN_REQUIRED',
		responseChecksumValidation: 'WHEN_REQUIRED'
	});
	return client;
}

function hostAllowed(hostname: string): boolean {
	const host = hostname.toLowerCase();
	return ALLOWED_HOSTS.has(host) || ALLOWED_SUFFIXES.some((s) => host.endsWith(s));
}

function sniffImage(b: Buffer): { ext: string; type: string } | null {
	if (b.length < 12) return null;
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
	if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
		return { ext: 'png', type: 'image/png' };
	}
	if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') {
		return { ext: 'webp', type: 'image/webp' };
	}
	if (b.subarray(0, 3).toString('ascii') === 'GIF') return { ext: 'gif', type: 'image/gif' };
	return null;
}

interface DownloadedImage {
	body: Buffer;
	ext: string;
	type: string;
}

/**
 * Downloads one image. Follows redirects by hand so every hop is checked
 * against the host allowlist. Returns null when there is no usable image.
 */
async function downloadImage(startUrl: string): Promise<DownloadedImage | null> {
	let current = startUrl.replace(/^http:\/\//i, 'https://');

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const url = new URL(current);
		if (url.protocol !== 'https:' || !hostAllowed(url.hostname)) {
			throw new Error(`Cover host not allowed: ${url.hostname}`);
		}

		const res = await fetch(url, {
			redirect: 'manual',
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' }
		});

		if (res.status >= 300 && res.status < 400) {
			const location = res.headers.get('location');
			await res.body?.cancel().catch(() => {});
			if (!location) return null;
			current = new URL(location, url).toString();
			continue;
		}

		if (!res.ok) {
			await res.body?.cancel().catch(() => {});
			return null; // a 404 simply means this provider has no cover
		}

		const declared = Number(res.headers.get('content-length') ?? 0);
		if (declared > MAX_BYTES) {
			await res.body?.cancel().catch(() => {});
			return null;
		}

		const body = Buffer.from(await res.arrayBuffer());
		if (body.length < MIN_BYTES || body.length > MAX_BYTES) return null;

		// Trust the file signature, not the Content-Type header
		const kind = sniffImage(body);
		return kind ? { body, ...kind } : null;
	}

	return null; // too many redirects
}

async function findExistingKey(prefix: string): Promise<string | null> {
	const config = storageConfig();
	const res = await getClient().send(
		new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix, MaxKeys: 1 })
	);
	return res.Contents?.[0]?.Key ?? null;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Saves the first usable cover from the candidate URLs into B2.
 * The key is deterministic, so calling this again for the same item
 * reuses the stored file instead of downloading it twice.
 * Never throws. A cover problem must not break a metadata lookup.
 */
export async function saveCoverFromCandidates(
	kind: CoverKind,
	id: string,
	candidateUrls: string[]
): Promise<CoverResult> {
	if (!isCoverStorageConfigured()) return { key: null, status: 'storage_not_configured' };

	const safeId = slugify(id);
	if (!safeId) return { key: null, status: 'error' };
	const prefix = `covers/${kind}/${safeId}.`;

	try {
		const existing = await findExistingKey(prefix);
		if (existing) return { key: existing, status: 'exists' };

		for (const url of candidateUrls) {
			let image: DownloadedImage | null = null;
			try {
				image = await downloadImage(url);
			} catch (err) {
				console.warn('Cover candidate skipped:', err instanceof Error ? err.message : err);
				continue;
			}
			if (!image) continue;

			const key = `${prefix}${image.ext}`;
			await getClient().send(
				new PutObjectCommand({
					Bucket: storageConfig().bucket,
					Key: key,
					Body: image.body,
					ContentType: image.type,
					CacheControl: 'public, max-age=604800'
				})
			);
			return { key, status: 'stored' };
		}

		return { key: null, status: 'not_found' };
	} catch (err) {
		console.error('Cover storage failed:', err);
		return { key: null, status: 'error' };
	}
}

/**
 * URL the browser can use for a stored key.
 * Uses the public bucket URL when B2_PUBLIC_URL is set, otherwise the
 * /api/covers proxy route (works with a private bucket).
 */
export function getCoverUrl(key: string | null | undefined): string | null {
	if (!key) return null;
	return `/api/images/cover/${encodeURIComponent(key)}`;
}

/** Reads a stored cover for the /api/covers proxy route */
export async function getCoverObject(
	key: string
): Promise<{ body: ReadableStream; type: string; length?: number } | null> {
	if (!isCoverStorageConfigured() || !KEY_PATTERN.test(key)) return null;

	try {
		const res = await getClient().send(new GetObjectCommand({ Bucket: storageConfig().bucket, Key: key }));
		if (!res.Body) return null;
		const body = (res.Body as unknown as { transformToWebStream(): ReadableStream }).transformToWebStream();
		return {
			body,
			type: res.ContentType ?? 'application/octet-stream',
			length: res.ContentLength
		};
	} catch (err) {
		const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
		if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null;
		console.error('Cover read failed:', err);
		return null;
	}
}