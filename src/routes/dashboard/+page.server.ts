import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';

// Example: check for a session cookie named 'token'
export const load: PageServerLoad = async ({ cookies }) => {
    const token = cookies.get('token');
    if (!token) {
        // Not logged in, redirect to login page
        throw redirect(302, '/');
    }

    // Optionally: verify token here

    // If logged in, allow access
    return
}