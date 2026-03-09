import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { verifyToken } from '$lib/server/db/auth.js';

export const load: PageServerLoad = async ({ cookies, url, fetch }) => {
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

    // Fetch fine settings
    const res = await fetch('/api/transactions?page=1&limit=1');
    const jsonData = res.ok ? await res.json() : {};
    const fineSettings = jsonData.fineSettings || null;

    return {
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            userType: user.userType,
            permissions: user.permissions
        },
        fineSettings
    };
};