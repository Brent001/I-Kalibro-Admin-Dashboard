import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_staff_permission, tbl_staff } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

// PATCH: Update staff permissions
export const PATCH: RequestHandler = async ({ request, params }) => {
  try {
    const { uniqueId } = params;
    const body = await request.json();
    const { canManageBooks, canManageUsers, canManageBorrowing, canManageReservations, canViewReports, canManageFines, customPermissions } = body;

    if (!uniqueId) {
      return json(
        { success: false, message: 'Staff unique ID is required' },
        { status: 400 }
      );
    }

    // Verify staff member exists
    const staff = await db
      .select()
      .from(tbl_staff)
      .where(eq(tbl_staff.uniqueId, uniqueId));

    if (staff.length === 0) {
      return json(
        { success: false, message: 'Staff member not found' },
        { status: 404 }
      );
    }

    const staffMember = staff[0];

    // Check if permission record exists
    const existingPermission = await db
      .select()
      .from(tbl_staff_permission)
      .where(eq(tbl_staff_permission.staffUniqueId, uniqueId));

    // Update or insert permissions
    if (existingPermission.length > 0) {
      await db.update(tbl_staff_permission)
        .set({
          canManageBooks: canManageBooks ?? existingPermission[0].canManageBooks,
          canManageUsers: canManageUsers ?? existingPermission[0].canManageUsers,
          canManageBorrowing: canManageBorrowing ?? existingPermission[0].canManageBorrowing,
          canManageReservations: canManageReservations ?? existingPermission[0].canManageReservations,
          canViewReports: canViewReports ?? existingPermission[0].canViewReports,
          canManageFines: canManageFines ?? existingPermission[0].canManageFines,
          customPermissions: customPermissions ?? existingPermission[0].customPermissions
        })
        .where(eq(tbl_staff_permission.staffUniqueId, uniqueId));
    } else {
      await db.insert(tbl_staff_permission).values({
        staffUniqueId: uniqueId,
        canManageBooks: canManageBooks ?? false,
        canManageUsers: canManageUsers ?? false,
        canManageBorrowing: canManageBorrowing ?? false,
        canManageReservations: canManageReservations ?? false,
        canViewReports: canViewReports ?? false,
        canManageFines: canManageFines ?? false,
        customPermissions: customPermissions ?? null
      });
    }

    return json({
      success: true,
      message: 'Permissions updated successfully'
    });
  } catch (err: any) {
    console.error('Error updating staff permissions:', err);
    throw error(500, { message: 'Failed to update permissions' });
  }
};

// GET: Fetch permissions for a specific staff member
export const GET: RequestHandler = async ({ params }) => {
  try {
    const { uniqueId } = params;

    if (!uniqueId) {
      return json(
        { success: false, message: 'Staff unique ID is required' },
        { status: 400 }
      );
    }

    const permission = await db
      .select()
      .from(tbl_staff_permission)
      .where(eq(tbl_staff_permission.staffUniqueId, uniqueId));

    if (permission.length === 0) {
      return json({
        success: true,
        data: {
          staffUniqueId: uniqueId,
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
      data: permission[0]
    });
  } catch (err) {
    console.error('Error fetching staff permissions:', err);
    throw error(500, { message: 'Failed to fetch staff permissions' });
  }
};
