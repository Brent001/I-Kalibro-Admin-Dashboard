import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { tbl_library_settings, tbl_admin, tbl_super_admin, tbl_staff, tbl_security_log } from '$lib/server/db/schema/schema.js';
import { eq, and } from 'drizzle-orm';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

async function authenticateUser(request: Request) {
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

        // Check super_admin
        const [superAdmin] = await db.select({ id: tbl_super_admin.id }).from(tbl_super_admin).where(and(eq(tbl_super_admin.id, userId), eq(tbl_super_admin.isActive, true))).limit(1);
        if (superAdmin) return { id: userId, role: 'super_admin' };

        // Check admin
        const [admin] = await db.select({ id: tbl_admin.id }).from(tbl_admin).where(and(eq(tbl_admin.id, userId), eq(tbl_admin.isActive, true))).limit(1);
        if (admin) return { id: userId, role: 'admin' };

        // Check staff
        const [staff] = await db.select({ id: tbl_staff.id }).from(tbl_staff).where(and(eq(tbl_staff.id, userId), eq(tbl_staff.isActive, true))).limit(1);
        if (staff) return { id: userId, role: 'staff' };

        return null;
    } catch (err) {
        console.error('authenticateUser error:', err);
        return null;
    }
}

// GET - return visitScanMethod setting
export const GET: RequestHandler = async ({ request }) => {
    const user = await authenticateUser(request);
    if (!user) return error(401, 'Unauthorized');

    try {
        const rows = await db.select().from(tbl_library_settings).where(eq(tbl_library_settings.settingKey, 'visitScanMethod')).limit(1);
        if (!rows || rows.length === 0) return json({ success: true, visitScanMethod: 'qrcode' }); // default
        const r = rows[0];
        let val: string = r.settingValue;
        return json({ success: true, visitScanMethod: val });
    } catch (err: any) {
        console.error('GET /api/settings/scan-method error:', err);
        return error(500, 'Failed to load scan method');
    }
};

// POST - update visitScanMethod (admin/super_admin only)
export const POST: RequestHandler = async ({ request }) => {
    const user = await authenticateUser(request);
    if (!user || !['admin', 'super_admin'].includes(user.role)) return error(403, 'Unauthorized');

    try {
        const body = await request.json();
        if (!body || typeof body.visitScanMethod !== 'string') return error(400, 'Invalid payload');

        const value = body.visitScanMethod;

        const existing = await db.select().from(tbl_library_settings).where(eq(tbl_library_settings.settingKey, 'visitScanMethod'));
        if (existing && existing.length > 0) {
            await db.update(tbl_library_settings).set({ settingValue: value, dataType: 'string', description: 'Visit scan method setting', updatedBy: user.id }).where(eq(tbl_library_settings.settingKey, 'visitScanMethod'));
        } else {
            await db.insert(tbl_library_settings).values({ settingKey: 'visitScanMethod', settingValue: value, dataType: 'string', description: 'Visit scan method setting', updatedBy: user.id });
        }

        // record security log entry for the update
        try {
            await db.insert(tbl_security_log).values({
                userId: user.id,
                userType: user.role,
                eventType: 'scan_method_update'
            });
        } catch (e) {
            console.debug('Failed to log scan method update:', e);
        }

        return json({ success: true });
    } catch (err: any) {
        console.error('POST /api/settings/scan-method error:', err);
        return error(500, err.message || 'Failed to update scan method');
    }
};