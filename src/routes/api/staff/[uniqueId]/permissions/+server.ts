import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { staffPermission, staffAccount } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

// PATCH: Update staff permissions
export const PATCH: RequestHandler = async ({ request, params }) => {
  try {
    const { uniqueId } = params;
    const body = await request.json();
    const { permissionKeys } = body;

    if (!uniqueId) {
      return json(
        { success: false, message: 'Staff unique ID is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(permissionKeys)) {
      return json(
        { success: false, message: 'Permission keys must be an array' },
        { status: 400 }
      );
    }

    // Verify staff member exists
    const staff = await db
      .select()
      .from(staffAccount)
      .where(eq(staffAccount.uniqueId, uniqueId));

    if (staff.length === 0) {
      return json(
        { success: false, message: 'Staff member not found' },
        { status: 404 }
      );
    }

    // Only allow staff role to have restricted permissions
    if (staff[0].role === 'admin') {
      return json(
        { success: false, message: 'Admin roles cannot have restricted permissions' },
        { status: 403 }
      );
    }

    // Check if permission record exists
    const existingPermission = await db
      .select()
      .from(staffPermission)
      .where(eq(staffPermission.staffUniqueId, uniqueId));

    let result;

    if (existingPermission.length > 0) {
      // Update existing permission record
      result = await db
        .update(staffPermission)
        .set({
          permissionKeys: permissionKeys
        })
        .where(eq(staffPermission.staffUniqueId, uniqueId))
        .returning();
    } else {
      // Create new permission record
      result = await db
        .insert(staffPermission)
        .values({
          staffUniqueId: uniqueId,
          permissionKeys: permissionKeys
        })
        .returning();
    }

    return json({
      success: true,
      message: 'Staff permissions updated successfully',
      data: {
        staffUniqueId: uniqueId,
        permissionKeys: permissionKeys,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error updating staff permissions:', err);
    throw error(500, { message: 'Failed to update staff permissions' });
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
      .from(staffPermission)
      .where(eq(staffPermission.staffUniqueId, uniqueId));

    if (permission.length === 0) {
      return json({
        success: true,
        data: {
          staffUniqueId: uniqueId,
          permissionKeys: []
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
