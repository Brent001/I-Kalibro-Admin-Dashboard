import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { staffPermission, staffAccount } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';

// GET: Fetch all staff permissions
export const GET: RequestHandler = async () => {
  try {
    const permissions = await db
      .select()
      .from(staffPermission);

    // Convert to object with uniqueId as key for easier lookup
    const permissionsMap: Record<string, any> = {};
    permissions.forEach(perm => {
      permissionsMap[perm.staffUniqueId] = {
        id: perm.id,
        staffUniqueId: perm.staffUniqueId,
        permissionKeys: perm.permissionKeys,
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
