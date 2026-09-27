import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { verifyToken } from '$lib/server/db/auth.js';

export const load: PageServerLoad = async ({ cookies }) => {
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

    // Redirect staff to dashboard
    if (user.userType === 'staff') {
        throw redirect(302, '/dashboard');
    }

    return {
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            userType: user.userType,
            permissions: user.permissions
        }
    };
};