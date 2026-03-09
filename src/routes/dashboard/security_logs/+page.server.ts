import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { verifyToken } from '$lib/server/db/auth.js';
import { getShortUid } from '$lib/utils/uidHelper.js';

export const load: PageServerLoad = async ({ cookies, url }) => {
    const token = cookies.get('token');
    
    if (!token) {
        throw redirect(302, '/');
    }

    const user = await verifyToken(token);
    if (!user) {
        cookies.delete('token', { path: '/' });
        cookies.delete('refresh_token', { path: '/' });
        throw redirect(302, '/');
    }

    // Security check: Validate uid parameter
    const requestedUid = url.searchParams.get('uid');
    // Use user ID for identifier
    const userIdentifier = user.id.toString();
    const shortUid = getShortUid(userIdentifier);
    
    if (requestedUid) {
        // If uid is provided in URL, validate it matches the user's identifier
        if (user.userType !== 'super_admin' && requestedUid !== shortUid) {
            console.warn(`Unauthorized access attempt: User ${shortUid} tried to access logs for ${requestedUid}`);
            throw redirect(302, `/dashboard/security_logs?uid=${shortUid}`);
        }
    } else {
        // No uid provided, redirect to own logs with short uid
        throw redirect(302, `/dashboard/security_logs?uid=${shortUid}`);
    }

    return {
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            userType: user.userType,
            permissions: user.permissions
        },
        shortUid
    };
};