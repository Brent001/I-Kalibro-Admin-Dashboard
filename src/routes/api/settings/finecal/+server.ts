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

// GET - return fineCalculation setting (parsed)
export const GET: RequestHandler = async () => {
    try {
        const rows = await db.select().from(tbl_library_settings).where(eq(tbl_library_settings.settingKey, 'fineCalculation')).limit(1);
        if (!rows || rows.length === 0) return json({ success: true, fineCalculation: null });
        const r = rows[0];
        let val: any = r.settingValue;
        if (r.dataType === 'json') {
            try { val = JSON.parse(r.settingValue); } catch { val = r.settingValue; }
        }
        return json({ success: true, fineCalculation: val });
    } catch (err: any) {
        console.error('GET /api/settings/finecal error:', err);
        return error(500, 'Failed to load fineCalculation');
    }
};

// POST - update fineCalculation (admin only)
export const POST: RequestHandler = async ({ request }) => {
    try {
        const admin = await authenticateAdmin(request);
        if (!admin) return error(403, 'Unauthorized');

        const body = await request.json();
        if (!body) return error(400, 'Invalid payload');

        const value = typeof body === 'object' ? JSON.stringify(body) : String(body);

        const existing = await db.select().from(tbl_library_settings).where(eq(tbl_library_settings.settingKey, 'fineCalculation'));
        if (existing && existing.length > 0) {
            await db.update(tbl_library_settings).set({ settingValue: value, dataType: 'json', description: 'Fine calculation settings', updatedBy: admin.id }).where(eq(tbl_library_settings.settingKey, 'fineCalculation'));
        } else {
            await db.insert(tbl_library_settings).values({ settingKey: 'fineCalculation', settingValue: value, dataType: 'json', description: 'Fine calculation settings', updatedBy: admin.id });
        }

        // record security log entry for the update
        try {
            await db.insert(tbl_security_log).values({
                userId: admin.id,
                userType: admin.role,
                eventType: 'fine_settings_update'
            });
        } catch (e) {
            console.debug('Failed to log fine settings update:', e);
        }

        return json({ success: true, message: 'Fine settings updated' });
    } catch (err: any) {
        console.error('POST /api/settings/finecal error:', err);
        return error(500, err.message || 'Failed to update fineCalculation');
    }
};
