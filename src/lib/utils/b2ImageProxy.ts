/**
 * Client-side utility for converting B2 URLs to proxy URLs
 * This ensures images are served through our secure proxy endpoint
 */

/**
 * Convert B2 URLs to proxy URLs or ensure they're already in proxy format
 * @param url - Direct B2 URL or already-proxied URL
 * @returns Proxy URL for the image
 */
export function ensureProxiedUrl(url: string | null): string | null {
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

/**
 * Check if a URL is already a proxy URL
 */
export function isProxyUrl(url: string | null): boolean {
    return url ? url.startsWith('/api/images/cover/') : false;
}

/**
 * Check if a URL is a direct B2 URL
 */
export function isB2Url(url: string | null): boolean {
    return url ? url.includes('backblazeb2.com') : false;
}
