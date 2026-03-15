import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { tbl_library_settings, tbl_admin, tbl_super_admin, tbl_security_log } from '$lib/server/db/schema/schema.js';
import { eq, and } from 'drizzle-orm';
import { isSessionRevoked } from '$lib/server/db/auth.js';

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

export const GET: RequestHandler = async () => {
    try {
        const rows = await db.select().from(tbl_library_settings).where(eq(tbl_library_settings.settingKey, 'notificationSettings')).limit(1);
        if (!rows || rows.length === 0) return json({ success: true, notifications: null });
        const r = rows[0];
        let val: any = r.settingValue;
        if (r.dataType === 'json') {
            try { val = JSON.parse(r.settingValue); } catch { val = r.settingValue; }
        }
        return json({ success: true, notifications: val });
    } catch (err: any) {
        console.error('GET /api/settings/notifications error:', err);
        return error(500, 'Failed to load notification settings');
    }
};

export const POST: RequestHandler = async ({ request }) => {
    try {
        const admin = await authenticateAdmin(request);
        if (!admin) return error(403, 'Unauthorized');

        const body = await request.json();
        if (!body || typeof body !== 'object') return error(400, 'Invalid payload');

        const value = JSON.stringify(body);

        const existing = await db.select().from(tbl_library_settings).where(eq(tbl_library_settings.settingKey, 'notificationSettings'));
        if (existing && existing.length > 0) {
            await db.update(tbl_library_settings).set({ settingValue: value, dataType: 'json', description: 'Notification settings', updatedBy: admin.id }).where(eq(tbl_library_settings.settingKey, 'notificationSettings'));
        } else {
            await db.insert(tbl_library_settings).values({ settingKey: 'notificationSettings', settingValue: value, dataType: 'json', description: 'Notification settings', updatedBy: admin.id });
        }

        try {
            await db.insert(tbl_security_log).values({
                userId: admin.id,
                userType: admin.role,
                eventType: 'notification_settings_update'
            });
        } catch (e) {
            console.debug('Failed to log notification settings update:', e);
        }

        return json({ success: true, message: 'Notification settings updated' });
    } catch (err: any) {
        console.error('POST /api/settings/notifications error:', err);
        return error(500, err.message || 'Failed to update notification settings');
    }
};
