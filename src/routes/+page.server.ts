import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { tbl_super_admin, tbl_admin, tbl_staff, tbl_user } from '$lib/server/db/schema/schema.js';
import { count, sql } from 'drizzle-orm';

async function getTotalUserCount(): Promise<number> {
    // Run all count queries in parallel for better performance
    const [adminResult, staffResult, userResult] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(tbl_super_admin),
        db.select({ count: sql<number>`count(*)` }).from(tbl_staff),
        db.select({ count: sql<number>`count(*)` }).from(tbl_user)
    ]);

    const adminCount = Number(adminResult[0]?.count ?? 0);
    const staffCount = Number(staffResult[0]?.count ?? 0);
    const userCount = Number(userResult[0]?.count ?? 0);

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