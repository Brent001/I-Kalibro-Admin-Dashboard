import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { tbl_super_admin, tbl_admin, tbl_staff, tbl_user } from '$lib/server/db/schema/schema.js';
import { count } from 'drizzle-orm';

async function getTotalUserCount(): Promise<number> {
    const [adminResult] = await db.select({ count: count() }).from(tbl_super_admin);
    const [staffResult] = await db.select({ count: count() }).from(tbl_staff);
    const [userResult] = await db.select({ count: count() }).from(tbl_user);
    
    const adminCount = Number(adminResult?.count ?? 0);
    const staffCount = Number(staffResult?.count ?? 0);
    const userCount = Number(userResult?.count ?? 0);
    
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