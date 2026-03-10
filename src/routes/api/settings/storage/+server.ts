import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { tbl_admin, tbl_super_admin } from '$lib/server/db/schema/schema.js';
import { eq, and } from 'drizzle-orm';
import { isSessionRevoked } from '$lib/server/db/auth.js';
import { getB2StorageUsage } from '$lib/server/utils/backblazeStorage.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

async function authenticateAdmin(request: Request) {
    try {
        let token: string | null = null;
        const authHeader = request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.substring(7);
        if (!token) {
            const cookieHeader = request.headers.get('cookie');
            if (cookieHeader) {
                const cookies = Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
                token = cookies.token;
            }
        }
        if (!token) return null;
        if (await isSessionRevoked(token)) return null;
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId || decoded.id;
        if (!userId) return null;

        // Check admin or super_admin
        const [admin] = await db.select({ id: tbl_admin.id }).from(tbl_admin).where(and(eq(tbl_admin.id, userId), eq(tbl_admin.isActive, true))).limit(1);
        if (admin) return { id: userId, role: 'admin' };
        const [superAdmin] = await db.select({ id: tbl_super_admin.id }).from(tbl_super_admin).where(and(eq(tbl_super_admin.id, userId), eq(tbl_super_admin.isActive, true))).limit(1);
        if (superAdmin) return { id: userId, role: 'super_admin' };
        return null;
    } catch (err) {
        console.error('authenticateAdmin error:', err);
        return null;
    }
}

// GET - return storage usage
export const GET: RequestHandler = async ({ request }) => {
    const admin = await authenticateAdmin(request);
    if (!admin) throw error(401, 'Unauthorized');

    try {
        const usage = await getB2StorageUsage();
        return json({ success: true, storage: usage });
    } catch (err) {
        console.error('Storage usage error:', err);
        return json({ success: false, error: 'Failed to retrieve storage usage' });
    }
};