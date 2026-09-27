import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { staffAccount, staffPermission } from '$lib/server/db/schema/schema.js';
import { eq, count } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// GET: Return all staff (admin and staff roles)
export const GET: RequestHandler = async () => {
  try {
    const staffList = await db
      .select()
      .from(staffAccount);

    const staff = staffList
      .filter(a => a.role === 'admin' || a.role === 'staff')
      .map(a => ({
        id: a.id,
        uniqueId: a.uniqueId,
        name: a.name,
        email: a.email,
        username: a.username,
        role: a.role,
        isActive: a.isActive,
        joined: a.createdAt,
      }));

    return json({
      success: true,
      data: { staff }
    });
  } catch (err) {
    console.error('Error fetching staff:', err);
    throw error(500, { message: 'Internal server error' });
  }
};

// POST: Add new staff (admin or staff)
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, username, password, role, permissionKeys } = body;

    if (!name || !email || !username || !password || !role) {
      return new Response(
        JSON.stringify({ message: 'Missing required fields: name, email, username, password, role' }),
        { status: 400 }
      );
    }

    if (!['admin', 'staff'].includes(role)) {
      throw error(400, { message: 'Invalid role. Must be admin or staff.' });
    }

    // Check for existing email/username
    const existingEmail = await db
      .select({ id: staffAccount.id })
      .from(staffAccount)
      .where(eq(staffAccount.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      throw error(409, { message: 'Email already exists' });
    }

    const existingUsername = await db
      .select({ id: staffAccount.id })
      .from(staffAccount)
      .where(eq(staffAccount.username, username))
      .limit(1);

    if (existingUsername.length > 0) {
      throw error(409, { message: 'Username already exists' });
    }

    const [newStaff] = await db
      .insert(staffAccount)
      .values({
        name,
        email,
        username,
        password: await bcrypt.hash(password, 10),
        role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning({
        id: staffAccount.id,
        uniqueId: staffAccount.uniqueId,
        name: staffAccount.name,
        email: staffAccount.email,
        username: staffAccount.username,
        role: staffAccount.role,
        isActive: staffAccount.isActive,
        createdAt: staffAccount.createdAt
      });

    // Only insert permissions for staff
    // if (role === 'staff' && permissionKeys && typeof permissionKeys === 'object') {
    //   if (!newStaff.uniqueId) {
    //     throw error(500, { message: 'Failed to generate uniqueId for staff.' });
    //   }
    //   await db.insert(staffPermission).values({
    //     staffUniqueId: newStaff.uniqueId,
    //     permissionKeys // store as object
    //   });
    // }

    return json({
      success: true,
      message: 'Staff added successfully',
      data: {
        id: newStaff.id,
        uniqueId: newStaff.uniqueId,
        name: newStaff.name,
        email: newStaff.email,
        username: newStaff.username,
        role: newStaff.role,
        isActive: newStaff.isActive,
        joined: newStaff.createdAt,
      }
    }, { status: 201 });

  } catch (err: any) {
    console.error('Error adding staff:', err);
    if (err.status) throw err;
    throw error(500, { message: 'Internal server error' });
  }
};

// PUT: Update staff details
export const PUT: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, isActive } = body;

    if (!id || typeof isActive !== 'boolean') {
      throw error(400, { message: 'Staff ID and isActive are required' });
    }

    // Check if staff exists
    const existingStaff = await db
      .select({ id: staffAccount.id, uniqueId: staffAccount.uniqueId })
      .from(staffAccount)
      .where(eq(staffAccount.id, id))
      .limit(1);

    if (existingStaff.length === 0) {
      throw error(404, { message: 'Staff not found' });
    }

    await db
      .update(staffAccount)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(staffAccount.id, id));

    return json({
      success: true,
      message: `Staff ${isActive ? 'enabled' : 'disabled'} successfully`
    });

  } catch (err: any) {
    console.error('Error updating staff status:', err);
    if (err.status) throw err;
    throw error(500, { message: 'Internal server error' });
  }
};

// PATCH: Update staff password and permissions
export const PATCH: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, username, password, permissionKeys } = body;

    if (!id) {
      throw error(400, { message: 'Staff ID is required' });
    }

    // Check if staff exists
    const staff = await db
      .select({ id: staffAccount.id, uniqueId: staffAccount.uniqueId, username: staffAccount.username, role: staffAccount.role })
      .from(staffAccount)
      .where(eq(staffAccount.id, id))
      .limit(1);

    if (staff.length === 0) {
      throw error(404, { message: 'Staff not found' });
    }

    // Update username if provided and changed
    if (username && username !== staff[0].username) {
      // Check for duplicate username
      const existingUsername = await db
        .select({ id: staffAccount.id })
        .from(staffAccount)
        .where(eq(staffAccount.username, username))
        .limit(1);

      if (existingUsername.length > 0) {
        throw error(409, { message: 'Username already exists' });
      }

      await db
        .update(staffAccount)
        .set({ username, updatedAt: new Date() })
        .where(eq(staffAccount.id, id));
    }

    // Update password if provided
    if (password && password.length >= 8) {
      await db
        .update(staffAccount)
        .set({ password: await bcrypt.hash(password, 10), updatedAt: new Date() })
        .where(eq(staffAccount.id, id));
    }

    // Update permissions if provided and staff is not admin
    // if (permissionKeys && typeof permissionKeys === 'object' && staff[0].role === 'staff') {
    //   const uniqueId = staff[0].uniqueId;
    //   if (!uniqueId) {
    //     throw error(400, { message: 'Staff uniqueId is missing.' });
    //   }
    //   // Upsert permissions
    //   const existingPerm = await db
    //     .select()
    //     .from(staffPermission)
    //     .where(eq(staffPermission.staffUniqueId, uniqueId))
    //     .limit(1);

    //   if (existingPerm.length > 0) {
    //     await db
    //       .update(staffPermission)
    //       .set({ permissionKeys })
    //       .where(eq(staffPermission.staffUniqueId, uniqueId));
    //   } else {
    //     await db.insert(staffPermission).values({
    //       staffUniqueId: uniqueId,
    //       permissionKeys
    //     });
    //   }
    // }

    return json({
      success: true,
      message: 'Staff updated successfully'
    });
  } catch (err: any) {
    console.error('Error updating staff:', err);
    if (err.status) throw err;
    throw error(500, { message: 'Internal server error' });
  }
};

// DELETE: Permanently remove staff
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      throw error(400, { message: 'Staff ID is required' });
    }

    // Check if staff exists
    const existingStaff = await db
      .select({ id: staffAccount.id, uniqueId: staffAccount.uniqueId })
      .from(staffAccount)
      .where(eq(staffAccount.id, id))
      .limit(1);

    if (existingStaff.length === 0) {
      throw error(404, { message: 'Staff not found' });
    }

    // Delete permissions first
    // if (!existingStaff[0].uniqueId) {
    //   throw error(400, { message: 'Staff uniqueId is missing.' });
    // }
    // await db.delete(staffPermission).where(eq(staffPermission.staffUniqueId, existingStaff[0].uniqueId));
    // Delete staff account
    await db.delete(staffAccount).where(eq(staffAccount.id, id));

    return json({
      success: true,
      message: 'Staff permanently deleted'
    });

  } catch (err: any) {
    console.error('Error deleting staff:', err);
    if (err.status) throw err;
    throw error(500, { message: 'Internal server error' });
  }
};