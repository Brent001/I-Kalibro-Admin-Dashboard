import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { downloadFileFromB2, getFileMetadataFromB2, buildResponseHeaders } from '$lib/server/utils/backblazeDownload.js';

/**
 * GET - Download/view cover photo from Backblaze B2
 * Serves images with proper caching and security headers
 * 
 * Usage:
 *   GET /api/images/cover/covers/book-123.jpg
 *   GET /api/images/cover/covers%2Fbook-123.jpg (URL encoded)
 */
export const GET: RequestHandler = async ({ params }) => {
    let fileName: string | undefined = params.fileName;
    try {
        // Handle URL-encoded paths
        if (fileName) {
            fileName = decodeURIComponent(fileName);
        }

        if (!fileName) {
            return error(400, 'Missing file name');
        }

        // Security: Prevent directory traversal
        if (fileName.includes('..') || fileName.includes('\\')) {
            return error(400, 'Invalid file path');
        }

        console.log('Serving cover photo:', fileName);

        // Download file from B2
        const { body, contentType, contentLength } = await downloadFileFromB2(fileName);

        // Convert body to an acceptable BodyInit for TypeScript runtimes
        let responseBody: BodyInit;
        if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
            responseBody = Buffer.from(body);
        } else {
            // Ensure we pass a plain ArrayBuffer (not SharedArrayBuffer) to Blob by copying
            const arrayBuffer = Uint8Array.from(body).buffer;
            responseBody = new Blob([arrayBuffer]);
        }

        // Build response with proper headers
        const headers = buildResponseHeaders(
            contentType,
            contentLength,
            fileName,
            true // inline - display in browser
        );

        return new Response(responseBody as unknown as BodyInit, {
            status: 200,
            headers
        });
    } catch (err: any) {
        console.error('Error serving cover photo:', {
            fileName,
            error: err?.message,
            code: err?.code,
            statusCode: err?.$metadata?.httpStatusCode,
            fullError: err
        });

        // Return 404 for not found, 500 for other errors
        if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404 || err.message?.includes('NoSuchKey')) {
            return error(404, 'Cover photo not found');
        }

        return error(500, `Failed to serve cover photo: ${err.message || 'Unknown error'}`);
    }
};

/**
 * HEAD - Get file metadata without downloading the full file
 * Useful for checking if file exists and its properties
 */
export const HEAD: RequestHandler = async ({ params }) => {
    try {
        let fileName = params.fileName;

        if (fileName) {
            fileName = decodeURIComponent(fileName);
        }

        if (!fileName) {
            return error(400, 'Missing file name');
        }

        if (fileName.includes('..') || fileName.includes('\\')) {
            return error(400, 'Invalid file path');
        }

        console.log('Checking cover photo metadata:', fileName);

        // Use metadata call to avoid downloading entire body for HEAD
        const meta = await getFileMetadataFromB2(fileName);
        if (!meta.exists) {
            return error(404, 'Cover photo not found');
        }

        const headers = buildResponseHeaders(
            meta.contentType || 'application/octet-stream',
            meta.contentLength,
            fileName,
            true
        );

        // Return empty body for HEAD request
        return new Response(null, {
            status: 200,
            headers
        });
    } catch (err: any) {
        console.error('Error checking cover photo:', err);

        if (err.message?.includes('NoSuchKey') || err.$metadata?.httpStatusCode === 404) {
            return error(404, 'Cover photo not found');
        }

        return error(500, 'Failed to check cover photo');
    }
};
