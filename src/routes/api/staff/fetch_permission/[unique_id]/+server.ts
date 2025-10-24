import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { staffAccount, staffPermission } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
  const { unique_id } = params;

  if (!unique_id) {
    throw error(400, { message: 'Missing staff unique_id' });
  }

  // Fetch staff account to check role
  const staff = await db
    .select({ role: staffAccount.role })
    .from(staffAccount)
    .where(eq(staffAccount.uniqueId, unique_id))
    .limit(1);

  if (staff.length === 0) {
    throw error(404, { message: 'Staff not found' });
  }

  const role = staff[0].role;

  if (role === 'admin') {
    // Admin: no restriction, return empty array or all permissions if you want
    return json({
      success: true,
      data: []
    });
  }

  if (role === 'staff') {
    // Staff: fetch permission keys
    const result = await db
      .select({ permissionKeys: staffPermission.permissionKeys })
      .from(staffPermission)
      .where(eq(staffPermission.staffUniqueId, unique_id))
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