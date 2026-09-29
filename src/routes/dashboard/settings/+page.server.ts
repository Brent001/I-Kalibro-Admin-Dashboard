import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { verifyToken } from '$lib/server/db/auth.js';
import { db } from '$lib/server/db/index.js';
import { tbl_library_settings } from '$lib/server/db/schema/schema.js';

function parseSetting(value: string, dataType: string | null) {
    if (dataType !== 'json') return value;
    try { return JSON.parse(value); } catch { return null; }
}

export const load: PageServerLoad = async ({ cookies, url }) => {
    const token = cookies.get('token');

    if (!token) {
        throw redirect(302, '/');
    }

    const user = await verifyToken(token);
    if (!user) {
        cookies.delete('token', { path: '/' });
        cookies.delete('refresh_token', { path: '/' });
        throw redirect(302, '/');
    }

    const isAdmin = user.userType === 'admin' || user.userType === 'super_admin';
    const rows = isAdmin ? await db.select().from(tbl_library_settings) : [];
    const settingsRow = rows.find(row => row.settingKey === 'systemSettings');
    const permissionsRow = rows.find(row => row.settingKey === 'defaultStaffPermissions');

    return {
        user: {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            userType: user.userType,
            permissions: user.permissions
        },
        settings: isAdmin && settingsRow ? parseSetting(settingsRow.settingValue, settingsRow.dataType) : null,
        defaultStaffPermissions: isAdmin && permissionsRow ? parseSetting(permissionsRow.settingValue, permissionsRow.dataType) : null
    };
};