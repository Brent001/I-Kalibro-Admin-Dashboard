import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { account, user } from '$lib/server/db/schema/schema.js';
import { count } from 'drizzle-orm';

async function getTotalUserCount(): Promise<number> {
    const [accountResult] = await db.select({ count: count() }).from(account);
    const [userResult] = await db.select({ count: count() }).from(user);
    
    const accountCount = Number(accountResult?.count ?? 0);
    const userCount = Number(userResult?.count ?? 0);
    
    return accountCount + userCount;
}

export const load: PageServerLoad = async ({ cookies }) => {
    const session = cookies.get('token');
    if (session) {
        return {
            dbError: false,
            redirect: '/dashboard'
        };
    }

    const totalUserCount = await getTotalUserCount();
    
    if (totalUserCount === 0) {
        return {
            dbError: false,
            redirect: '/setup'
        };
    }

    return {
        dbError: false
    };
};