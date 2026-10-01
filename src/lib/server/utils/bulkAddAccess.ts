import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { tbl_library_settings } from '$lib/server/db/schema/schema.js';
import { hasPermission, verifyToken } from '$lib/server/db/auth.js';

export async function getBulkAddAccess(token: string | undefined) {
	const user = token ? await verifyToken(token) : null;
	if (!user || !['staff', 'admin', 'super_admin'].includes(user.userType)) {
		return { user: null, enabled: false, authorized: false };
	}

	if (user.userType === 'staff' && !hasPermission(user, 'canManageBooks')) {
		return { user, enabled: false, authorized: false };
	}

	const [row] = await db.select({ settingValue: tbl_library_settings.settingValue })
		.from(tbl_library_settings)
		.where(eq(tbl_library_settings.settingKey, 'systemSettings'))
		.limit(1);

	let enabled = false;
	if (row) {
		try {
			const settings = JSON.parse(row.settingValue);
			enabled = settings?.bulkAddEnabled === true;
		} catch {
			enabled = false;
		}
	}

	return { user, enabled, authorized: enabled };
}
