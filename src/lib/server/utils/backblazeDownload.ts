import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

function initializeS3Client(): S3Client {
    if (s3Client) return s3Client;

    const region = (process.env.BACKBLAZE_REGION || import.meta.env.VITE_BACKBLAZE_REGION as string) || 'us-east-005';
    const keyId = (process.env.BACKBLAZE_KEY_ID || import.meta.env.VITE_BACKBLAZE_KEY_ID as string) || '';
    const appKey = (process.env.BACKBLAZE_APPLICATION_KEY || import.meta.env.VITE_BACKBLAZE_APPLICATION_KEY as string) || '';

    console.log('Initializing S3Client for download:', {
        region,
        hasKeyId: !!keyId,
        hasAppKey: !!appKey,
        keyIdPrefix: keyId.substring(0, 10) + '...',
        source: (process.env.BACKBLAZE_KEY_ID ? 'process.env' : 'import.meta.env')
    });

    if (!keyId || !appKey) {
        throw new Error(`Missing Backblaze credentials. KeyId: ${!!keyId}, AppKey: ${!!appKey}. Check BACKBLAZE_KEY_ID and BACKBLAZE_APPLICATION_KEY environment variables.`);
    }

    s3Client = new S3Client({
        region,
        endpoint: `https://s3.${region}.backblazeb2.com`,
        credentials: {
            accessKeyId: keyId,
            secretAccessKey: appKey
        },
        forcePathStyle: true
    });

    return s3Client;
}

/**
 * Download a file from Backblaze B2
 * @param fileName - The file path in the bucket (e.g., "covers/book-123.jpg")
 * @returns Object containing file buffer, content type, and metadata
 */
export async function downloadFileFromB2(fileName: string): Promise<{
    body: Uint8Array;
    contentType: string;
    contentLength?: number;
    lastModified?: Date;
}> {
    const bucketName = (process.env.BACKBLAZE_BUCKET_NAME || import.meta.env.VITE_BACKBLAZE_BUCKET_NAME as string) || 'E-kalibro';

    console.log('downloadFileFromB2:', {
        fileName,
        bucketName
    });

    const client = initializeS3Client();

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileName
    });

    try {
        const response = await client.send(command);
        console.log('GetObjectCommand response received:', {
            contentType: response.ContentType,
            contentLength: response.ContentLength,
            hasBody: !!response.Body
        });

        // Convert stream to buffer
        const chunks: Uint8Array[] = [];
        const body = response.Body;

        if (!body) {
            throw new Error('No response body from B2');
        }

        // Handle different response body types
        if (body instanceof Uint8Array) {
            console.log('Body is Uint8Array, size:', body.length);
            chunks.push(body);
        } else if (typeof body === 'string') {
            console.log('Body is string, converting to Uint8Array');
            chunks.push(new TextEncoder().encode(body));
        } else if (Symbol.asyncIterator in body) {
            // It's an async iterable (stream)
            console.log('Body is async iterable, reading stream...');
            let chunkCount = 0;
            for await (const chunk of body as AsyncIterable<Uint8Array>) {
                chunks.push(chunk);
                chunkCount++;
            }
            console.log('Stream read complete, chunks:', chunkCount);
        } else {
            console.warn('Unexpected body type:', typeof body, Object.keys(body || {}));
            throw new Error(`Unexpected response body type: ${typeof body}`);
        }

        const buffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
        }

        console.log('File downloaded successfully, total size:', buffer.length);

        return {
            body: buffer,
            contentType: response.ContentType || 'application/octet-stream',
            contentLength: response.ContentLength,
            lastModified: response.LastModified
        };
    } catch (error: any) {
        console.error('B2 download error:', {
            message: error.message,
            code: error.code,
            statusCode: error.$metadata?.httpStatusCode,
            errorType: error.name,
            fileName
        });
        throw new Error(`Failed to download from B2: ${error.message}`);
    }
}

/**
 * Get file metadata from Backblaze B2 without downloading the full file
 * Useful for checking if file exists and getting content type
 */
export async function getFileMetadataFromB2(fileName: string): Promise<{
    exists: boolean;
    contentType?: string;
    contentLength?: number;
    lastModified?: Date;
}> {
    const bucketName = (process.env.BACKBLAZE_BUCKET_NAME || import.meta.env.VITE_BACKBLAZE_BUCKET_NAME as string) || 'E-kalibro';

    console.log('getFileMetadataFromB2:', {
        fileName,
        bucketName
    });

    const client = initializeS3Client();

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileName
    });

    try {
        const response = await client.send(command);
        return {
            exists: true,
            contentType: response.ContentType || 'application/octet-stream',
            contentLength: response.ContentLength,
            lastModified: response.LastModified
        };
    } catch (error: any) {
        // Handle 404 gracefully
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
            console.log('File not found in B2:', fileName);
            return { exists: false };
        }
        console.error('B2 metadata error:', error);
        throw new Error(`Failed to get metadata from B2: ${error.message}`);
    }
}

/**
 * Get appropriate cache headers for images
 * @param contentType - The MIME type of the file
 * @returns Object with cache control headers
 */
export function getCacheHeaders(contentType: string): {
    'Cache-Control': string;
    'CDN-Cache-Control'?: string;
} {
    // Cache images for 1 hour. Adjust based on your needs.
    if (contentType.startsWith('image/')) {
        return {
            'Cache-Control': 'public, max-age=3600, immutable'
        };
    }

    // Default: cache for 5 minutes
    return {
        'Cache-Control': 'public, max-age=300'
    };
}

/**
 * Build response headers for file download/viewing
 */
export function buildResponseHeaders(
    contentType: string,
    contentLength?: number,
    fileName?: string,
    inline: boolean = true
): HeadersInit {
    const headers: Record<string, string> = {
        'Content-Type': contentType,
        ...getCacheHeaders(contentType)
    };

    if (contentLength) {
        headers['Content-Length'] = contentLength.toString();
    }

    // Set Content-Disposition header
    if (fileName) {
        // Use 'inline' to display in browser, 'attachment' to download
        const disposition = inline ? 'inline' : 'attachment';
        const encodedFileName = encodeURIComponent(fileName);
        headers['Content-Disposition'] = `${disposition}; filename*=UTF-8''${encodedFileName}`;
    }

    // Security headers
    headers['X-Content-Type-Options'] = 'nosniff';

    return headers;
}
