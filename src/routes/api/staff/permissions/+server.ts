import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_staff_permission, tbl_staff } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

// GET: Fetch all staff permissions
export const GET: RequestHandler = async () => {
  try {
    const permissions = await db
      .select()
      .from(tbl_staff_permission);

    // Convert to object with staffUniqueId as key for easier lookup
    const permissionsMap: Record<string, any> = {};
    permissions.forEach(perm => {
      permissionsMap[perm.staffUniqueId] = {
        id: perm.id,
        staffUniqueId: perm.staffUniqueId,
        canManageBooks: perm.canManageBooks,
        canManageUsers: perm.canManageUsers,
        canManageBorrowing: perm.canManageBorrowing,
        canManageReservations: perm.canManageReservations,
        canViewReports: perm.canViewReports,
        canManageFines: perm.canManageFines,
        customPermissions: perm.customPermissions,
        createdAt: perm.createdAt
      };
    });

    return json({
      success: true,
      data: permissionsMap
    });
  } catch (err) {
    console.error('Error fetching staff permissions:', err);
    throw error(500, { message: 'Failed to fetch staff permissions' });
  }
};
