// File: src/routes/api/user/[id]/restriction/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_user_restriction, tbl_staff } from '$lib/server/db/schema/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

async function authenticateUser(request: Request): Promise<{ id: number; userType: string } | null> {
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

        // Check if staff/admin/super_admin (have permission to manage restrictions)
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

// GET - Fetch all restrictions for a user
export const GET: RequestHandler = async ({ params, request }) => {
    try {
        const authUser = await authenticateUser(request);
        if (!authUser) {
            throw error(401, { message: 'Unauthorized' });
        }

        const userId = parseInt(params.id);
        if (isNaN(userId)) {
            throw error(400, { message: 'Invalid user ID' });
        }

        const restrictions = await db
            .select({
                id: tbl_user_restriction.id,
                restrictionType: tbl_user_restriction.restrictionType,
                reason: tbl_user_restriction.reason,
                startDate: tbl_user_restriction.startDate,
                endDate: tbl_user_restriction.endDate,
                appliedBy: tbl_user_restriction.appliedBy,
                isActive: tbl_user_restriction.isActive,
                createdAt: tbl_user_restriction.createdAt,
                updatedAt: tbl_user_restriction.updatedAt
            })
            .from(tbl_user_restriction)
            .where(and(eq(tbl_user_restriction.userId, userId), eq(tbl_user_restriction.isActive, true)))
            .orderBy(desc(tbl_user_restriction.createdAt));

        return json({
            success: true,
            restrictions
        });
    } catch (err: any) {
        console.error('GET /api/user/[id]/restriction error:', err);
        return json(
            { success: false, message: err.message || 'Failed to fetch restrictions' },
            { status: err.status || 500 }
        );
    }
};

// POST - Add new restriction
export const POST: RequestHandler = async ({ params, request }) => {
    try {
        const authUser = await authenticateUser(request);
        if (!authUser) {
            throw error(401, { message: 'Unauthorized' });
        }

        const userId = parseInt(params.id);
        if (isNaN(userId)) {
            throw error(400, { message: 'Invalid user ID' });
        }

        const body = await request.json();
        const { restrictionType, reason, startDate, endDate } = body;

        if (!restrictionType) {
            throw error(400, { message: 'restrictionType is required' });
        }

        // Validate restriction type
        const validTypes = ['ban_borrowing', 'ban_reservation', 'temporary_suspension'];
        if (!validTypes.includes(restrictionType)) {
            throw error(400, { message: 'Invalid restriction type' });
        }

        const [newRestriction] = await db
            .insert(tbl_user_restriction)
            .values({
                userId,
                restrictionType,
                reason: reason || null,
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : null,
                appliedBy: authUser.id,
                isActive: true
            })
            .returning();

        return json({
            success: true,
            message: 'Restriction added successfully',
            data: newRestriction
        });
    } catch (err: any) {
        console.error('POST /api/user/[id]/restriction error:', err);
        return json(
            { success: false, message: err.message || 'Failed to add restriction' },
            { status: err.status || 500 }
        );
    }
};

// PUT - Update restriction
export const PUT: RequestHandler = async ({ params, request }) => {
    try {
        const authUser = await authenticateUser(request);
        if (!authUser) {
            throw error(401, { message: 'Unauthorized' });
        }

        const userId = parseInt(params.id);
        if (isNaN(userId)) {
            throw error(400, { message: 'Invalid user ID' });
        }

        const body = await request.json();
        const { restrictionId, restrictionType, reason, startDate, endDate, isActive } = body;

        if (!restrictionId) {
            throw error(400, { message: 'restrictionId is required' });
        }

        const updateData: any = {};
        if (restrictionType !== undefined) updateData.restrictionType = restrictionType;
        if (reason !== undefined) updateData.reason = reason;
        if (startDate !== undefined) updateData.startDate = new Date(startDate);
        if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
        if (isActive !== undefined) updateData.isActive = isActive;

        const [updatedRestriction] = await db
            .update(tbl_user_restriction)
            .set(updateData)
            .where(and(eq(tbl_user_restriction.id, restrictionId), eq(tbl_user_restriction.userId, userId)))
            .returning();

        if (!updatedRestriction) {
            throw error(404, { message: 'Restriction not found' });
        }

        return json({
            success: true,
            message: 'Restriction updated successfully',
            data: updatedRestriction
        });
    } catch (err: any) {
        console.error('PUT /api/user/[id]/restriction error:', err);
        return json(
            { success: false, message: err.message || 'Failed to update restriction' },
            { status: err.status || 500 }
        );
    }
};

// DELETE - Remove restriction (soft delete by setting isActive to false)
export const DELETE: RequestHandler = async ({ params, request }) => {
    try {
        const authUser = await authenticateUser(request);
        if (!authUser) {
            throw error(401, { message: 'Unauthorized' });
        }

        const userId = parseInt(params.id);
        if (isNaN(userId)) {
            throw error(400, { message: 'Invalid user ID' });
        }

        const body = await request.json();
        const { restrictionId } = body;

        if (!restrictionId) {
            throw error(400, { message: 'restrictionId is required' });
        }

        const [deletedRestriction] = await db
            .update(tbl_user_restriction)
            .set({ isActive: false })
            .where(and(eq(tbl_user_restriction.id, restrictionId), eq(tbl_user_restriction.userId, userId)))
            .returning();

        if (!deletedRestriction) {
            throw error(404, { message: 'Restriction not found' });
        }

        return json({
            success: true,
            message: 'Restriction removed successfully'
        });
    } catch (err: any) {
        console.error('DELETE /api/user/[id]/restriction error:', err);
        return json(
            { success: false, message: err.message || 'Failed to remove restriction' },
            { status: err.status || 500 }
        );
    }
};