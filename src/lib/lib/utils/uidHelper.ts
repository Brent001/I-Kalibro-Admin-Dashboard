/**
 * Masks a UUID for display purposes
 * Shows first 8 characters + last 4 characters
 * Example: 550e8400-e29b-41d4-a716-446655440000 -> 550e8400****0000
 */
export function maskUid(uid: string): string {
    if (!uid || uid.length < 12) return uid;
    const first = uid.substring(0, 8);
    const last = uid.substring(uid.length - 4);
    return `${first}****${last}`;
}

/**
 * Extracts the first part of UUID (8 chars) for short identifier
 */
export function getShortUid(uid: string): string {
    if (!uid || uid.length < 10) return uid; // Ensure minimum length for operations
    const cleanedUid = uid.replace(/-/g, ''); // Remove hyphens
    if (cleanedUid.length < 10) return cleanedUid; // After cleaning, still too short

    const first4 = cleanedUid.substring(0, 4);
    const middle2 = cleanedUid.substring(cleanedUid.length / 2 - 1, cleanedUid.length / 2 + 1);
    const last4 = cleanedUid.substring(cleanedUid.length - 4);
    return `${first4}${middle2}${last4}`;
}
