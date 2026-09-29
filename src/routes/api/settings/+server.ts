import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { and, eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db/index.js';
import { isSessionRevoked } from '$lib/server/db/auth.js';
import { tbl_admin, tbl_library_settings, tbl_security_log, tbl_super_admin } from '$lib/server/db/schema/schema.js';

const SETTINGS_KEY = 'systemSettings';
const DEFAULT_PERMISSIONS_KEY = 'defaultStaffPermissions';

async function authenticateAdmin(request: Request) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
        || request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith('token='))?.slice(6);
    if (!token || await isSessionRevoked(token)) return null;

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production') as { userId?: number; id?: number };
        const userId = decoded.userId || decoded.id;
        if (!userId) return null;

        const [admin] = await db.select({ id: tbl_admin.id }).from(tbl_admin)
            .where(and(eq(tbl_admin.id, userId), eq(tbl_admin.isActive, true))).limit(1);
        if (admin) return { id: admin.id, role: 'admin' } as const;

        const [superAdmin] = await db.select({ id: tbl_super_admin.id }).from(tbl_super_admin)
            .where(and(eq(tbl_super_admin.id, userId), eq(tbl_super_admin.isActive, true))).limit(1);
        return superAdmin ? { id: superAdmin.id, role: 'super_admin' } as const : null;
    } catch {
        return null;
    }
}

function parseSetting(row: { settingValue: string; dataType: string | null } | undefined) {
    if (!row) return null;
    if (row.dataType === 'json') {
        try { return JSON.parse(row.settingValue); } catch { return null; }
    }
    return row.settingValue;
}

async function saveSetting(key: string, value: unknown, adminId: number, description: string) {
    const settingValue = JSON.stringify(value);
    const existing = await db.select({ id: tbl_library_settings.id }).from(tbl_library_settings)
        .where(eq(tbl_library_settings.settingKey, key)).limit(1);

    if (existing.length) {
        await db.update(tbl_library_settings).set({ settingValue, dataType: 'json', description, updatedBy: adminId, updatedAt: new Date() })
            .where(eq(tbl_library_settings.settingKey, key));
    } else {
        await db.insert(tbl_library_settings).values({ settingKey: key, settingValue, dataType: 'json', description, updatedBy: adminId });
    }
}

export const GET: RequestHandler = async ({ request }) => {
    const admin = await authenticateAdmin(request);
    if (!admin) throw error(403, 'Unauthorized');

    const rows = await db.select().from(tbl_library_settings);
    return json({
        success: true,
        settings: parseSetting(rows.find(row => row.settingKey === SETTINGS_KEY)),
        defaultStaffPermissions: parseSetting(rows.find(row => row.settingKey === DEFAULT_PERMISSIONS_KEY))
    });
};

export const POST: RequestHandler = async ({ request }) => {
    const admin = await authenticateAdmin(request);
    if (!admin) throw error(403, 'Unauthorized');

    const body = await request.json();
    if (!body || typeof body !== 'object') throw error(400, 'Invalid settings payload');

    const { defaultStaffPermissions, ...settings } = body as Record<string, unknown>;
    await saveSetting(SETTINGS_KEY, settings, admin.id, 'Library and system settings');
    if (defaultStaffPermissions !== undefined) {
        await saveSetting(DEFAULT_PERMISSIONS_KEY, defaultStaffPermissions, admin.id, 'Default staff permissions');
    }

    try {
        await db.insert(tbl_security_log).values({ userId: admin.id, userType: admin.role, eventType: 'settings_update' });
    } catch (logError) {
        console.debug('Failed to log settings update:', logError);
    }
    return json({ success: true, message: 'Settings updated' });
};