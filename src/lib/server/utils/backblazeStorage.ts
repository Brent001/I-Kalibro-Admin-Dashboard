import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

function initializeS3Client(): S3Client {
    if (s3Client) return s3Client;

    const region = (process.env.BACKBLAZE_REGION || import.meta.env.VITE_BACKBLAZE_REGION as string) || 'us-east-005';
    const keyId = (process.env.BACKBLAZE_KEY_ID || import.meta.env.VITE_BACKBLAZE_KEY_ID as string) || '';
    const appKey = (process.env.BACKBLAZE_APPLICATION_KEY || import.meta.env.VITE_BACKBLAZE_APPLICATION_KEY as string) || '';

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

export async function getB2StorageUsage(): Promise<{
    used: number;
    total: number;
    usedFormatted: string;
    totalFormatted: string;
    percentage: number;
}> {
    const bucketName = (process.env.BACKBLAZE_BUCKET_NAME || import.meta.env.VITE_BACKBLAZE_BUCKET_NAME as string) || 'E-kalibro';
    const client = initializeS3Client();

    let totalSize = 0;
    let continuationToken: string | undefined;

    try {
        do {
            const command = new ListObjectsV2Command({
                Bucket: bucketName,
                ContinuationToken: continuationToken,
                MaxKeys: 1000 // Fetch in batches
            });

            const response = await client.send(command);

            if (response.Contents) {
                for (const obj of response.Contents) {
                    totalSize += obj.Size || 0;
                }
            }

            continuationToken = response.NextContinuationToken;
        } while (continuationToken);

        // Backblaze B2 free tier is 10GB
        const totalBytes = 10 * 1024 * 1024 * 1024; // 10GB in bytes
        const percentage = (totalSize / totalBytes) * 100;

        const formatBytes = (bytes: number): string => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        return {
            used: totalSize,
            total: totalBytes,
            usedFormatted: formatBytes(totalSize),
            totalFormatted: formatBytes(totalBytes),
            percentage: Math.round(percentage * 100) / 100
        };
    } catch (error) {
        console.error('Error getting B2 storage usage:', error);
        throw error;
    }
}

export async function listB2Files(prefix: string = ''): Promise<{
    files: { name: string; type: 'file'; size: string; modified: string; key: string }[];
    folders: { name: string; type: 'folder' }[];
}> {
    const bucketName = (process.env.BACKBLAZE_BUCKET_NAME || import.meta.env.VITE_BACKBLAZE_BUCKET_NAME as string) || 'E-kalibro';
    const client = initializeS3Client();

    const files: { name: string; type: 'file'; size: string; modified: string; key: string }[] = [];
    const folders: { name: string; type: 'folder' }[] = [];
    const folderSet = new Set<string>();

    let continuationToken: string | undefined;

    try {
        do {
            const command = new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: prefix,
                Delimiter: '/', // This makes it list "folders" as common prefixes
                ContinuationToken: continuationToken,
                MaxKeys: 1000
            });

            const response = await client.send(command);

            // Common prefixes are the "folders"
            if (response.CommonPrefixes) {
                for (const cp of response.CommonPrefixes) {
                    const folderName = cp.Prefix!.replace(prefix, '').replace(/\/$/, '');
                    if (folderName && !folderSet.has(folderName)) {
                        folderSet.add(folderName);
                        folders.push({ name: folderName, type: 'folder' });
                    }
                }
            }

            // Contents are the files
            if (response.Contents) {
                for (const obj of response.Contents) {
                    if (obj.Key === prefix) continue; // Skip the "folder" itself if it's a key
                    const fileName = obj.Key!.replace(prefix, '');
                    if (!fileName.includes('/')) { // Only files directly in this "folder"
                        const size = obj.Size || 0;
                        const formatBytes = (bytes: number): string => {
                            if (bytes === 0) return '0 B';
                            const k = 1024;
                            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                            const i = Math.floor(Math.log(bytes) / Math.log(k));
                            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                        };
                        files.push({
                            name: fileName,
                            type: 'file',
                            size: formatBytes(size),
                            modified: obj.LastModified ? obj.LastModified.toISOString().split('T')[0] : '',
                            key: obj.Key!
                        });
                    }
                }
            }

            continuationToken = response.NextContinuationToken;
        } while (continuationToken);

        return { files, folders };
    } catch (error) {
        console.error('Error listing B2 files:', error);
        throw error;
    }
}