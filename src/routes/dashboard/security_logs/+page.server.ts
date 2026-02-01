import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { isSessionRevoked } from '$lib/server/db/auth.js';
import { getShortUid } from '$lib/utils/uidHelper.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export const load: PageServerLoad = async ({ cookies, url }) => {
    const token = cookies.get('token');
    
    if (!token) {
        throw redirect(302, '/');
    }

    // Check if session has been revoked (logout from all devices)
    if (await isSessionRevoked(token)) {
        console.warn('Session has been revoked');
        cookies.delete('token', { path: '/' });
        cookies.delete('refresh_token', { path: '/' });
        throw redirect(302, '/');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId || decoded.id;
        
        if (!userId) {
            cookies.delete('token', { path: '/' });
            throw redirect(302, '/');
        }

        // Use user data from JWT token (no database query needed)
        const user = {
            id: userId,
            uniqueId: decoded.uniqueId,
            username: decoded.username,
            email: decoded.email,
            userType: decoded.userType,
            isActive: true
        };

        // Security check: Validate uid parameter
        const requestedUid = url.searchParams.get('uid');
        // Use uniqueId if available, otherwise use user ID as fallback (for old tokens)
        const userIdentifier = user.uniqueId || String(user.id);
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
                uniqueId: user.uniqueId,
                username: user.username,
                email: user.email,
                userType: user.userType
            }
        };

    } catch (error) {
        // Only handle JWT verification errors, let redirect errors pass through
        if (error instanceof SyntaxError || (error as any)?.name === 'JsonWebTokenError') {
            cookies.delete('token', { path: '/' });
            throw redirect(302, '/');
        }
        // Re-throw other errors (including redirect)
        throw error;
    }
};