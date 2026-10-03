import bcrypt from 'bcrypt';
import { sql } from 'drizzle-orm';
import { db, ensureDatabaseSchema } from '$lib/server/db/index.js';
import { tbl_library_settings, tbl_super_admin } from '$lib/server/db/schema/schema.js';
import {
	DEFAULT_FINE_CALCULATION,
	DEFAULT_NOTIFICATION_SETTINGS,
	DEFAULT_STAFF_PERMISSIONS,
	DEFAULT_SYSTEM_SETTINGS
} from '$lib/settings/defaults.js';

interface InitialAdminInput {
	name: string;
	email: string;
	username: string;
	password: string;
}

export async function createInitialSuperAdmin(input: InitialAdminInput) {
	await ensureDatabaseSchema();
	const hashedPassword = await bcrypt.hash(input.password, 12);

	return db.transaction(async (tx) => {
		await tx.execute(sql`SELECT pg_advisory_xact_lock(741203, 2)`);

		const [existingAdmin] = await tx
			.select({ id: tbl_super_admin.id })
			.from(tbl_super_admin)
			.limit(1);
		if (existingAdmin) return null;

		const [admin] = await tx
			.insert(tbl_super_admin)
			.values({
				name: input.name,
				email: input.email,
				username: input.username,
				password: hashedPassword,
				isActive: true
			})
			.returning({
				id: tbl_super_admin.id,
				uniqueId: tbl_super_admin.uniqueId,
				name: tbl_super_admin.name,
				email: tbl_super_admin.email,
				username: tbl_super_admin.username,
				isActive: tbl_super_admin.isActive
			});

		await tx.insert(tbl_library_settings).values([
			{
				settingKey: 'systemSettings',
				settingValue: JSON.stringify(DEFAULT_SYSTEM_SETTINGS),
				dataType: 'json',
				description: 'Library and system settings',
				updatedBy: admin.id
			},
			{
				settingKey: 'defaultStaffPermissions',
				settingValue: JSON.stringify(DEFAULT_STAFF_PERMISSIONS),
				dataType: 'json',
				description: 'Default staff permissions',
				updatedBy: admin.id
			},
			{
				settingKey: 'fineCalculation',
				settingValue: JSON.stringify(DEFAULT_FINE_CALCULATION),
				dataType: 'json',
				description: 'Fine calculation settings',
				updatedBy: admin.id
			},
			{
				settingKey: 'twoFactorAuth',
				settingValue: 'false',
				dataType: 'string',
				description: 'Two-factor authentication setting',
				updatedBy: admin.id
			},
			{
				settingKey: 'notificationSettings',
				settingValue: JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS),
				dataType: 'json',
				description: 'Notification settings',
				updatedBy: admin.id
			},
			{
				settingKey: 'visitScanMethod',
				settingValue: 'qrcode',
				dataType: 'string',
				description: 'Visit scan method setting',
				updatedBy: admin.id
			}
		]).onConflictDoNothing({ target: tbl_library_settings.settingKey });

		return admin;
	});
}