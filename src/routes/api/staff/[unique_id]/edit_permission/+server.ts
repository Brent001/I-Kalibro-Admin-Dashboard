// File: /api/staff/[unique_id]/permissions/+server.ts

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { staffAccount, staffPermission } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

// GET: Fetch staff permissions by uniqueId
export const GET: RequestHandler = async ({ params }) => {
  try {
    const { unique_id } = params;

    if (!unique_id) {
      throw error(400, { message: 'unique_id is required' });
    }

    // Check if staff exists
    const staff = await db
      .select({ uniqueId: staffAccount.uniqueId, role: staffAccount.role })
      .from(staffAccount)
      .where(eq(staffAccount.uniqueId, unique_id))
      .limit(1);

    if (staff.length === 0) {
      throw error(404, { message: 'Staff not found' });
    }

    // If admin, return all permissions (admins have full access)
    if (staff[0].role === 'admin') {
      return json({
        success: true,
        data: {
          permissionKeys: [
            'view_books',
            'view_members',
            'view_transactions',
            'view_visits',
            'view_logs',
            'view_reports',
            'view_staff',
            'view_settings'
          ]
        }
      });
    }

    // Fetch permissions for staff
    const permissions = await db
      .select()
      .from(staffPermission)
      .where(eq(staffPermission.staffUniqueId, unique_id))
      .limit(1);

    if (permissions.length === 0) {
      // No permissions set yet, return empty array
      return json({
        success: true,
        data: {
          permissionKeys: []
        }
      });
    }

    return json({
      success: true,
      data: {
        permissionKeys: permissions[0].permissionKeys || []
      }
    });
  } catch (err: any) {
    console.error('Error fetching permissions:', err);
    if (err.status) throw err;
    throw error(500, { message: 'Internal server error' });
  }
}

// PATCH: Update staff permissions by uniqueId
export const PATCH: RequestHandler = async ({ params, request }) => {
  try {
    const { unique_id } = params;
    const { permissionKeys } = await request.json();

    if (!unique_id || !Array.isArray(permissionKeys)) {
      throw error(400, { message: 'Missing unique_id or permissionKeys' });
    }

    // Check if staff exists
    const staff = await db
      .select({ uniqueId: staffAccount.uniqueId, role: staffAccount.role })
      .from(staffAccount)
      .where(eq(staffAccount.uniqueId, unique_id))
      .limit(1);

    if (staff.length === 0) {
      throw error(404, { message: 'Staff not found' });
    }

    if (staff[0].role !== 'staff') {
      throw error(403, { message: 'Only staff permissions can be edited.' });
    }

    // Upsert permissions
    const existingPerm = await db
      .select()
      .from(staffPermission)
      .where(eq(staffPermission.staffUniqueId, unique_id))
      .limit(1);

    if (existingPerm.length > 0) {
      await db
        .update(staffPermission)
        .set({ permissionKeys })
        .where(eq(staffPermission.staffUniqueId, unique_id));
    } else {
      await db.insert(staffPermission).values({
        staffUniqueId: unique_id,
        permissionKeys
      });
    }

    return json({
      success: true,
      message: 'Permissions updated successfully'
    });
  } catch (err: any) {
    console.error('Error updating permissions:', err);
    if (err.status) throw err;
    throw error(500, { message: 'Internal server error' });
  }
};