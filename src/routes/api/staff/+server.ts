import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { staffAccount } from '$lib/server/db/schema/schema.js'; // updated import
import { eq, count } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// GET: Return all staff (admin and staff roles)
export const GET: RequestHandler = async () => {
  try {
    const staffList = await db
      .select()
      .from(staffAccount); // updated

    const staff = staffList
      .filter(a => a.role === 'admin' || a.role === 'staff')
      .map(a => ({
        id: a.id,
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
    const { name, email, username, password, role } = body;

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
      .from(staffAccount) // updated
      .where(eq(staffAccount.email, email)) // updated
      .limit(1);

    if (existingEmail.length > 0) {
      throw error(409, { message: 'Email already exists' });
    }

    const existingUsername = await db
      .select({ id: staffAccount.id })
      .from(staffAccount) // updated
      .where(eq(staffAccount.username, username)) // updated
      .limit(1);

    if (existingUsername.length > 0) {
      throw error(409, { message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const insertData = {
      name,
      email,
      username,
      password: hashedPassword,
      role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      tokenVersion: 0,
    };

    const [newStaff] = await db
      .insert(staffAccount) // updated
      .values(insertData)
      .returning();

    return json({
      success: true,
      message: 'Staff added successfully',
      data: {
        id: newStaff.id,
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
    const { id, name, email, username, password, role, isActive } = body;

    if (!id) {
      throw error(400, { message: 'Staff ID is required' });
    }

    // Check if staff exists
    const existingStaff = await db
      .select({ id: staffAccount.id, role: staffAccount.role, tokenVersion: staffAccount.tokenVersion })
      .from(staffAccount) // updated
      .where(eq(staffAccount.id, id)) // updated
      .limit(1);

    if (existingStaff.length === 0) {
      throw error(404, { message: 'Staff not found' });
    }

    // Prepare update data
    let updateData: any = {
      name: name ?? undefined,
      email: email ?? undefined,
      username: username ?? undefined,
      role: role ?? undefined,
      isActive: isActive !== undefined ? isActive : undefined,
      updatedAt: new Date(),
    };

    // Hash new password if provided
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
      updateData.tokenVersion = (existingStaff[0].tokenVersion ?? 0) + 1;
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        updateData[key] = null;
      }
    });

    const [updatedStaff] = await db
      .update(staffAccount) // updated
      .set(updateData)
      .where(eq(staffAccount.id, id)) // updated
      .returning();

    return json({
      success: true,
      message: 'Staff updated successfully',
      data: updatedStaff
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
      .select({ id: staffAccount.id })
      .from(staffAccount) // updated
      .where(eq(staffAccount.id, id)) // updated
      .limit(1);

    if (existingStaff.length === 0) {
      throw error(404, { message: 'Staff not found' });
    }

    await db.delete(staffAccount).where(eq(staffAccount.id, id)); // updated
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