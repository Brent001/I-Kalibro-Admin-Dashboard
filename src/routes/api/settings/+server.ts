import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { verifyToken } from '$lib/server/db/auth.js';
import { tbl_library_settings, tbl_security_log } from '$lib/server/db/schema/schema.js';

const SETTINGS_KEY = 'systemSettings';
const DEFAULT_PERMISSIONS_KEY = 'defaultStaffPermissions';

async function authenticateAdmin(request: Request, cookies: { get(name: string): string | undefined }) {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
        || cookies.get('token');
    if (!token) return null;

    const user = await verifyToken(token);
    if (!user || (user.userType !== 'admin' && user.userType !== 'super_admin')) return null;

    return {
        id: user.id,
        role: user.userType === 'admin' ? 'admin' : 'super_admin'
    } as const;
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

export const GET: RequestHandler = async ({ request, cookies }) => {
    const admin = await authenticateAdmin(request, cookies);
    if (!admin) throw error(403, 'Unauthorized');

    const rows = await db.select().from(tbl_library_settings);
    return json({
        success: true,
        settings: parseSetting(rows.find(row => row.settingKey === SETTINGS_KEY)),
        defaultStaffPermissions: parseSetting(rows.find(row => row.settingKey === DEFAULT_PERMISSIONS_KEY))
    });
};

export const POST: RequestHandler = async ({ request, cookies }) => {
    const admin = await authenticateAdmin(request, cookies);
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