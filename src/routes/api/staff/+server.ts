// src/routes/api/staff/+server.ts - Staff management with new role hierarchy

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import {
    tbl_staff,
    tbl_staff_permission,
    tbl_admin,
    tbl_super_admin,
    tbl_library_settings
} from '$lib/server/db/schema/schema.js';
import bcrypt from 'bcrypt';
import { isSessionRevoked } from '$lib/server/db/auth.js';
import { randomBytes } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

interface AuthenticatedUser {
    id: number;
    userType: 'super_admin' | 'admin' | 'staff';
}

async function authenticateUser(request: Request): Promise<AuthenticatedUser | null> {
    try {
        let token: string | null = null;

        const authHeader = request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }

        if (!token) {
            const cookieHeader = request.headers.get('cookie');
            if (cookieHeader) {
                const cookies = Object.fromEntries(
                    cookieHeader.split('; ').map(c => c.split('='))
                );
                token = cookies.token;
            }
        }

        if (!token || await isSessionRevoked(token)) return null;

        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.userId;

        if (!userId) return null;

        // Check super_admin
        const [superAdmin] = await db
            .select({ id: tbl_super_admin.id })
            .from(tbl_super_admin)
            .where(and(eq(tbl_super_admin.id, userId), eq(tbl_super_admin.isActive, true)))
            .limit(1);

        if (superAdmin) return { id: userId, userType: 'super_admin' };

        // Check admin
        const [admin] = await db
            .select({ id: tbl_admin.id })
            .from(tbl_admin)
            .where(and(eq(tbl_admin.id, userId), eq(tbl_admin.isActive, true)))
            .limit(1);

        if (admin) return { id: userId, userType: 'admin' };

        // Check staff
        const [staff] = await db
            .select({ id: tbl_staff.id })
            .from(tbl_staff)
            .where(and(eq(tbl_staff.id, userId), eq(tbl_staff.isActive, true)))
            .limit(1);

        if (staff) return { id: userId, userType: 'staff' };

        return null;
    } catch (err) {
        console.error('Auth error:', err);
        return null;
    }
}

// GET - Fetch all staff members
export const GET: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized' });
        }

        const staffMembers = await db
            .select()
            .from(tbl_staff)
            .where(eq(tbl_staff.isActive, true));

        // Fetch permissions for each staff member
        const staffWithPermissions = await Promise.all(
            staffMembers.map(async (staff) => {
                const { password: _staffPassword, ...safeStaff } = staff;
                // staff.uniqueId should always be defined, but guard against null
                if (!staff.uniqueId) {
                    return { ...safeStaff, role: 'staff' as const, permissions: null };
                }

                const [permissions] = await db
                    .select()
                    .from(tbl_staff_permission)
                    .where(eq(tbl_staff_permission.staffUniqueId, staff.uniqueId))
                    .limit(1);

                return {
                    ...safeStaff,
                    role: 'staff' as const,
                    permissions: permissions || null
                };
            })
        );

        const admins = user.userType === 'super_admin'
            ? (await db.select().from(tbl_admin).where(eq(tbl_admin.isActive, true)))
                .map(admin => {
                    const { password: _adminPassword, ...safeAdmin } = admin;
                    return { ...safeAdmin, role: 'admin' as const, permissions: null };
                })
            : [];

        return json({
            success: true,
            data: [...admins, ...staffWithPermissions]
        });
    } catch (err: any) {
        console.error('GET /api/staff error:', err);
        return json(
            { success: false, message: err.message || 'Failed to fetch staff' },
            { status: err.status || 500 }
        );
    }
};

// POST - Create new staff member
export const POST: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized' });
        }

        const body = await request.json();
        const {
            name,
            email,
            username,
            password,
            department,
            position,
            role = 'staff',
            permissions
        } = body;

        if (!name || !email || !username || !password) {
            throw error(400, { message: 'name, email, username, and password are required' });
        }

        if (role !== 'staff' && role !== 'admin') {
            throw error(400, { message: 'Invalid account role' });
        }

        if (role === 'admin') {
            if (user.userType !== 'super_admin') throw error(403, { message: 'Only the super admin can create administrators' });
            const hashedPassword = await bcrypt.hash(password, 10);
            const [admin] = await db.insert(tbl_admin).values({
                uniqueId: randomBytes(18).toString('hex'),
                name,
                email,
                username,
                password: hashedPassword,
                isActive: true
            }).returning();
            return json({
                success: true,
                message: 'Administrator created successfully',
                data: { ...admin, role: 'admin', permissions: null }
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const uniqueId = randomBytes(18).toString('hex');

        const [staff] = await db
            .insert(tbl_staff)
            .values({
                uniqueId,
                name,
                email,
                username,
                password: hashedPassword,
                department: department || null,
                position: position || null,
                isActive: true
            })
            .returning();

        // Use the library policy for new staff, while allowing an explicit per-staff override.
        let savedDefaults: Record<string, unknown> = {};
        if (!permissions) {
            const [defaultPermissionSetting] = await db
                .select({ settingValue: tbl_library_settings.settingValue })
                .from(tbl_library_settings)
                .where(eq(tbl_library_settings.settingKey, 'defaultStaffPermissions'))
                .limit(1);
            if (defaultPermissionSetting) {
                try {
                    const parsed = JSON.parse(defaultPermissionSetting.settingValue);
                    if (parsed && typeof parsed === 'object') savedDefaults = parsed;
                } catch {
                    savedDefaults = {};
                }
            }
        }

        const staffPermissions = permissions || {
            canManageBooks: false,
            canManageUsers: false,
            canManageBorrowing: true,
            canManageReservations: true,
            canViewReports: false,
            canManageFines: true,
            customPermissions: [],
            ...savedDefaults
        };

        const [perm] = await db
            .insert(tbl_staff_permission)
            .values({
                staffUniqueId: uniqueId,
                ...staffPermissions
            })
            .returning();

        return json({
            success: true,
            message: 'Staff member created successfully',
            data: { ...staff, permissions: perm }
        });
    } catch (err: any) {
        console.error('POST /api/staff error:', err);
        return json(
            { success: false, message: err.message || 'Failed to create staff' },
            { status: err.status || 500 }
        );
    }
};

// PUT - Update staff member
export const PUT: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized' });
        }

        const body = await request.json();
        const { id, uniqueId, password, permissions, role = 'staff', ...updateData } = body;

        if (!id) {
            throw error(400, { message: 'id is required' });
        }

        if (role === 'admin') {
            if (user.userType !== 'super_admin') throw error(403, { message: 'Only the super admin can edit administrators' });
            const adminPayload: Record<string, unknown> = {};
            for (const key of ['name', 'email', 'username', 'isActive']) {
                if (key in updateData) adminPayload[key] = updateData[key];
            }
            if (password) adminPayload.password = await bcrypt.hash(password, 10);
            const [admin] = await db.update(tbl_admin).set(adminPayload).where(eq(tbl_admin.id, id)).returning();
            if (!admin) throw error(404, { message: 'Administrator not found' });
            return json({ success: true, message: 'Administrator updated successfully', data: { ...admin, role: 'admin', permissions: null } });
        }

        const [existingStaff] = await db.select({ id: tbl_staff.id }).from(tbl_staff).where(eq(tbl_staff.id, id)).limit(1);
        if (!existingStaff) throw error(404, { message: 'Staff member not found' });

        let updatePayload: any = updateData;

        // Hash password if provided
        if (password) {
            updatePayload.password = await bcrypt.hash(password, 10);
        }

        const [staff] = await db
            .update(tbl_staff)
            .set(updatePayload)
            .where(eq(tbl_staff.id, id))
            .returning();

        // Update permissions if provided
        if (permissions && uniqueId) {
            await db
                .update(tbl_staff_permission)
                .set(permissions)
                .where(eq(tbl_staff_permission.staffUniqueId, uniqueId));
        }

        return json({
            success: true,
            message: 'Staff member updated successfully',
            data: staff
        });
    } catch (err: any) {
        console.error('PUT /api/staff error:', err);
        return json(
            { success: false, message: err.message || 'Failed to update staff' },
            { status: err.status || 500 }
        );
    }
};

// DELETE - Deactivate staff member
export const DELETE: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized' });
        }

        const body = await request.json();
        const { id, role = 'staff' } = body;

        if (!id) {
            throw error(400, { message: 'id is required' });
        }

        if (role === 'admin') {
            if (user.userType !== 'super_admin') throw error(403, { message: 'Only the super admin can deactivate administrators' });
            const [admin] = await db.update(tbl_admin).set({ isActive: false }).where(eq(tbl_admin.id, id)).returning();
            if (!admin) throw error(404, { message: 'Administrator not found' });
            return json({ success: true, message: 'Administrator deactivated successfully', data: { ...admin, role: 'admin' } });
        }

        const [existingStaff] = await db.select({ id: tbl_staff.id }).from(tbl_staff).where(eq(tbl_staff.id, id)).limit(1);
        if (!existingStaff) throw error(404, { message: 'Staff member not found' });

        const [staff] = await db
            .update(tbl_staff)
            .set({ isActive: false })
            .where(eq(tbl_staff.id, id))
            .returning();

        return json({
            success: true,
            message: 'Staff member deactivated successfully',
            data: staff
        });
    } catch (err: any) {
        console.error('DELETE /api/staff error:', err);
        return json(
            { success: false, message: err.message || 'Failed to delete staff' },
            { status: err.status || 500 }
        );
    }
};
