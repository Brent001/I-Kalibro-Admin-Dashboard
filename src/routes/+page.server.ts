import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { account, user } from '$lib/server/db/schema/schema.js';
import { count } from 'drizzle-orm';

// Query the account and user tables for the number of users
async function getTotalUserCount(): Promise<number> {
    const [{ count: accountCount }] = await db.select({ count: count() }).from(account);
    const [{ count: userCount }] = await db.select({ count: count() }).from(user);
    return Number(accountCount) + Number(userCount);
}

export const load: PageServerLoad = async ({ cookies }) => {
    // Check for session cookie (should be 'token')
    const session = cookies.get('token');
    if (session) {
        // If session exists, redirect to dashboard
        throw redirect(302, '/dashboard');
    }

    try {
        const totalUserCount = await getTotalUserCount();
        if (totalUserCount === 0) {
            // No users or accounts: redirect to setup page
            throw redirect(302, '/setup');
        }
        // Otherwise, allow access to login page
        return { dbError: false };
    } catch (err) {
        // Database connection error
        return { dbError: true };
    }
};