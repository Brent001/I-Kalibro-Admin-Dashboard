import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

function initializeS3Client(): S3Client {
    if (s3Client) return s3Client;

    const region = (import.meta.env.VITE_BACKBLAZE_REGION as string) || 'us-east-005';
    const keyId = (import.meta.env.VITE_BACKBLAZE_KEY_ID as string) || '';
    const appKey = (import.meta.env.VITE_BACKBLAZE_APPLICATION_KEY as string) || '';

    console.log('Initializing S3Client with:', {
        region,
        keyId: !!keyId,
        appKey: !!appKey
    });

    if (!keyId || !appKey) {
        throw new Error(`Missing Backblaze credentials. KeyId: ${!!keyId}, AppKey: ${!!appKey}`);
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

export async function uploadCoverPhotoToB2(
    fileName: string,
    fileContent: Buffer,
    contentType: string,
    itemType: string = 'book'
): Promise<string> {
    const bucketName = (import.meta.env.VITE_BACKBLAZE_BUCKET_NAME as string) || 'E-Kalibro';
    
    // Organize by item type: books/covers/, magazines/covers/, etc.
    const itemTypeFolder = itemType.endsWith('s') ? itemType : `${itemType}s`;
    const organizedFileName = `${itemTypeFolder}/covers/${fileName}`;

    console.log('uploadCoverPhotoToB2:', {
        fileName,
        organizedFileName,
        bucketName,
        itemType,
        fileSize: fileContent.length,
        contentType
    });

    const client = initializeS3Client();

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: organizedFileName,
        Body: fileContent,
        ContentType: contentType
    });

    try {
        const response = await client.send(command);
        console.log('Upload successful:', response);

        // Generate the public URL
        const photoUrl = generateCoverPhotoUrl(organizedFileName);
        return photoUrl;
    } catch (error: any) {
        console.error('B2 upload error:', error);
        throw new Error(`Failed to upload to B2: ${error.message}`);
    }
}

export async function uploadProfilePhotoToB2(
    fileName: string,
    fileContent: Buffer,
    contentType: string
): Promise<string> {
    const bucketName = (import.meta.env.VITE_BACKBLAZE_BUCKET_NAME as string) || 'E-Kalibro';
    const organizedFileName = `profiles/${fileName}`;

    console.log('uploadProfilePhotoToB2:', {
        fileName,
        organizedFileName,
        bucketName,
        fileSize: fileContent.length,
        contentType
    });

    const client = initializeS3Client();

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: organizedFileName,
        Body: fileContent,
        ContentType: contentType
    });

    try {
        const response = await client.send(command);
        console.log('Profile upload successful:', response);

        const photoUrl = generateProfilePhotoUrl(organizedFileName);
        return photoUrl;
    } catch (error: any) {
        console.error('B2 profile upload error:', error);
        throw new Error(`Failed to upload profile to B2: ${error.message}`);
    }
}

export function generateCoverPhotoUrl(fileName: string): string {
    // Return a proxy URL through our own endpoint for authenticated access
    // This allows viewing of images even if B2 bucket doesn't have public access enabled
    // Format: /api/images/cover/{fileName}
    return `/api/images/cover/${encodeURIComponent(fileName)}`;
}

export function generateProfilePhotoUrl(fileName: string): string {
    // Proxy endpoint for profile photos
    return `/api/images/profile/${encodeURIComponent(fileName)}`;
}

/**
 * Convert old direct B2 URLs to proxy URLs
 * Handles URLs already in proxy format
 */
export function convertToProxyUrl(url: string | null): string | null {
    if (!url) return null;
    
    // Already a proxy URL - return as is
    if (url.startsWith('/api/images/cover/') || url.startsWith('/api/images/profile/')) {
        return url;
    }
    
    // Direct B2 URL - convert to proxy format
    if (url.includes('backblazeb2.com')) {
        try {
            // URLs might be encoded: books%2Fcovers%2F or decoded: books/covers/
            // Extract everything starting from item type folder like books/, magazines/
            let filePath = '';
            
            // Try encoded format first (for new structure: books%2Fcovers%2F, magazines%2Fcovers%2F)
            const encodedMatch = url.match(/[a-z]+s%2Fcovers%2F.+/);
            const profileEncodedMatch = url.match(/profiles%2F.+/);
            if (encodedMatch) {
                filePath = decodeURIComponent(encodedMatch[0]);
            } else if (profileEncodedMatch) {
                filePath = decodeURIComponent(profileEncodedMatch[0]);
            } else {
                // Try decoded format (for new structure: books/covers/, magazines/covers/)
                const decodedMatch = url.match(/[a-z]+s\/covers\/.+/);
                const profileDecodedMatch = url.match(/profiles\/.+/);
                if (decodedMatch) {
                    filePath = decodedMatch[0].replace(/^\//, '');
                } else if (profileDecodedMatch) {
                    filePath = profileDecodedMatch[0].replace(/^\//, '');
                } else {
                    // Fallback to old format (covers/)
                    const oldEncodedMatch = url.match(/covers%2F.+/);
                    if (oldEncodedMatch) {
                        filePath = decodeURIComponent(oldEncodedMatch[0]);
                    } else {
                        const oldDecodedMatch = url.match(/covers\/.+/);
                        if (oldDecodedMatch) {
                            filePath = oldDecodedMatch[0].replace(/^\//, '');
                        }
                    }
                }
            }
            
            if (filePath) {
                // If filePath starts with profiles/, route to profile proxy
                if (filePath.startsWith('profiles/')) {
                    return `/api/images/profile/${encodeURIComponent(filePath)}`;
                }
                return `/api/images/cover/${encodeURIComponent(filePath)}`;
            }
        } catch (err) {
            console.error('Error converting B2 URL to proxy URL:', err, url);
        }
    }
    
    // Return original if can't parse
    return url;
}
