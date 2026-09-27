import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

/**
 * Debug endpoint to test B2 connection and list files
 */
export const GET: RequestHandler = async () => {
    try {
        const region = (import.meta.env.VITE_BACKBLAZE_REGION as string) || 'us-east-005';
        const keyId = (import.meta.env.VITE_BACKBLAZE_KEY_ID as string) || '';
        const appKey = (import.meta.env.VITE_BACKBLAZE_APPLICATION_KEY as string) || '';
        const bucketName = (import.meta.env.VITE_BACKBLAZE_BUCKET_NAME as string) || 'E-kalibro';

        console.log('Debug endpoint - Environment check:', {
            region,
            hasKeyId: !!keyId,
            hasAppKey: !!appKey,
            bucketName,
            keyIdLength: keyId.length,
            appKeyLength: appKey.length
        });

        if (!keyId || !appKey) {
            return json({
                error: 'Missing credentials',
                keyId: !!keyId,
                appKey: !!appKey
            }, { status: 500 });
        }

        // Initialize S3 client
        const client = new S3Client({
            region,
            endpoint: `https://s3.${region}.backblazeb2.com`,
            credentials: {
                accessKeyId: keyId,
                secretAccessKey: appKey
            },
            forcePathStyle: true
        });

        console.log('S3 client initialized, connecting to bucket:', bucketName);

        // List files in bucket
        const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'covers/',
            MaxKeys: 10
        });

        const listResponse = await client.send(listCommand);

        console.log('Files listed successfully:', listResponse.Contents?.length);

        const files = listResponse.Contents?.map(obj => ({
            key: obj.Key,
            size: obj.Size,
            modified: obj.LastModified
        })) || [];

        return json({
            success: true,
            region,
            bucket: bucketName,
            endpoint: `https://s3.${region}.backblazeb2.com`,
            filesCount: files.length,
            files,
            credentials: {
                keyIdPrefix: keyId.substring(0, 10) + '...',
                appKeyLength: appKey.length
            }
        });
    } catch (error: any) {
        console.error('Debug endpoint error:', {
            message: error.message,
            code: error.code,
            statusCode: error.$metadata?.httpStatusCode,
            region: import.meta.env.VITE_BACKBLAZE_REGION
        });

        return json({
            error: error.message || 'Unknown error',
            code: error.code,
            statusCode: error.$metadata?.httpStatusCode
        }, { status: 500 });
    }
};
