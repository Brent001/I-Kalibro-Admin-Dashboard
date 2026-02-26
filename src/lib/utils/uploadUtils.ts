/**
 * Backblaze B2 Cover Photo Upload Utility
 * Server-side handling via AWS SDK
 */

export interface UploadOptions {
    itemId: number;
    itemType: 'book' | 'magazine';
    onProgress?: (progress: number) => void;
    onSuccess?: (url: string) => void;
    onError?: (error: string) => void;
}

/**
 * Get token from storage (localStorage or cookies)
 */
function getTokenFromStorage(): string {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('token') || '';
    }
    return '';
}

/**
 * Upload cover photo to backend which handles B2 upload
 */
export async function uploadCoverPhoto(
    file: File,
    options: UploadOptions
): Promise<string> {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('itemId', options.itemId.toString());
        formData.append('itemType', options.itemType);

        const response = await fetch('/api/image/upload/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getTokenFromStorage()}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.message || response.statusText;
            options.onError?.(errorMessage);
            throw new Error(errorMessage);
        }

        const result = await response.json();
        options.onSuccess?.(result.photoUrl);
        return result.photoUrl;
    } catch (error: any) {
        const errorMessage = error.message || 'Upload failed';
        options.onError?.(errorMessage);
        throw error;
    }
}
