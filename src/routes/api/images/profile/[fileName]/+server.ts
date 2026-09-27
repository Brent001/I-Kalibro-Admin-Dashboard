import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { downloadFileFromB2, getFileMetadataFromB2, buildResponseHeaders } from '$lib/server/utils/backblazeDownload.js';

/**
 * GET - Download/view profile photo from Backblaze B2
 * Serves images with proper caching and security headers
 *
 * Usage examples:
 *   GET /api/images/profile/profiles%2Fuser-123.jpg
 *   GET /api/images/profile/profiles/user-123.jpg
 */
export const GET: RequestHandler = async ({ params }) => {
    let fileName: string | undefined = params.fileName;
    try {
        if (fileName) fileName = decodeURIComponent(fileName);

        if (!fileName) return error(400, 'Missing file name');

        if (fileName.includes('..') || fileName.includes('\\')) return error(400, 'Invalid file path');

        console.log('Serving profile photo:', fileName);

        const { body, contentType, contentLength } = await downloadFileFromB2(fileName);

        let responseBody: BodyInit;
        if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
            responseBody = Buffer.from(body);
        } else {
            // Ensure we pass a plain ArrayBuffer (not SharedArrayBuffer) to Blob by copying
            const arrayBuffer = Uint8Array.from(body).buffer;
            responseBody = new Blob([arrayBuffer]);
        }

        const headers = buildResponseHeaders(contentType, contentLength, fileName, true);

        return new Response(responseBody as unknown as BodyInit, { status: 200, headers });
    } catch (err: any) {
        console.error('Error serving profile photo:', { fileName, error: err?.message, full: err });
        if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404 || err.message?.includes('NoSuchKey')) {
            return error(404, 'Profile photo not found');
        }
        return error(500, `Failed to serve profile photo: ${err.message || 'Unknown error'}`);
    }
};

export const HEAD: RequestHandler = async ({ params }) => {
    try {
        let fileName = params.fileName;
        if (fileName) fileName = decodeURIComponent(fileName);
        if (!fileName) return error(400, 'Missing file name');
        if (fileName.includes('..') || fileName.includes('\\')) return error(400, 'Invalid file path');

        const meta = await getFileMetadataFromB2(fileName);
        if (!meta.exists) return error(404, 'Profile photo not found');

        const headers = buildResponseHeaders(meta.contentType || 'application/octet-stream', meta.contentLength, fileName, true);
        return new Response(null, { status: 200, headers });
    } catch (err: any) {
        console.error('Error checking profile photo metadata:', err);
        if (err.message?.includes('NoSuchKey') || err.$metadata?.httpStatusCode === 404) return error(404, 'Profile photo not found');
        return error(500, 'Failed to check profile photo');
    }
};
