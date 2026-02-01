import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_staff, tbl_staff_permission } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
  const { unique_id } = params;

  if (!unique_id) {
    throw error(400, { message: 'Missing staff unique_id' });
  }

  // Fetch staff to check if exists
  const staff = await db
    .select({ id: tbl_staff.id })
    .from(tbl_staff)
    .where(eq(tbl_staff.uniqueId, unique_id))
    .limit(1);

  if (staff.length === 0) {
    throw error(404, { message: 'Staff not found' });
  }

  // Fetch permissions
  const result = await db
    .select()
    .from(tbl_staff_permission)
    .where(eq(tbl_staff_permission.staffId, staff[0].id))
    .limit(1);

  if (result.length === 0) {
    return json({
      success: true,
      data: {
        canManageBooks: false,
        canManageUsers: false,
        canManageBorrowing: false,
        canManageReservations: false,
        canViewReports: false,
        canManageFines: false,
        customPermissions: null
      }
    });
  }

  return json({
    success: true,
    data: result[0]
  });
};
      .limit(1);

    if (result.length === 0) {
      throw error(404, { message: 'Permissions not found for this staff member' });
    }

    return json({
      success: true,
      data: result[0].permissionKeys
    });
  }

  // Not staff or admin
  throw error(403, { message: 'Forbidden' });
};