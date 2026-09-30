import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { tbl_super_admin, tbl_admin, tbl_staff, tbl_user } from '$lib/server/db/schema/schema.js';
import { count } from 'drizzle-orm';

async function getTotalUserCount(): Promise<number> {
    // Run all count queries in parallel for better performance
    const [adminResults, staffResults, userResults] = await Promise.all([
        db.select({ count: count() }).from(tbl_super_admin),
        db.select({ count: count() }).from(tbl_staff),
        db.select({ count: count() }).from(tbl_user)
    ]);

    const adminCount = Number(adminResults[0]?.count ?? 0);
    const staffCount = Number(staffResults[0]?.count ?? 0);
    const userCount = Number(userResults[0]?.count ?? 0);

    return adminCount + staffCount + userCount;
}

export const load: PageServerLoad = async ({ cookies }) => {
    const session = cookies.get('token');
    if (session) {
        return {
            dbError: false,
            redirect: '/dashboard'
        };
    }

    let totalUserCount: number;
    try {
        totalUserCount = await getTotalUserCount();
    } catch (error) {
        console.error('[Home] Could not check setup status:', error);
        throw redirect(302, '/setup');
    }
    
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