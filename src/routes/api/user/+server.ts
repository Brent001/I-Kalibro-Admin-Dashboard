// src/routes/api/user/+server.ts - Library user (student/faculty) management

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import {
    tbl_user,
    tbl_student,
    tbl_faculty,
    tbl_super_admin,
    tbl_admin,
    tbl_staff
} from '$lib/server/db/schema/schema.js';
import bcrypt from 'bcrypt';
import { isSessionRevoked } from '$lib/server/db/auth.js';
import { randomBytes } from 'crypto';

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

        // Check if staff/admin/super_admin (have permission to manage users)
        const [staff] = await db
            .select({ id: tbl_staff.id })
            .from(tbl_staff)
            .where(and(eq(tbl_staff.id, userId), eq(tbl_staff.isActive, true)))
            .limit(1);

        if (staff) return { id: userId, userType: 'staff' };

        const [admin] = await db
            .select({ id: tbl_admin.id })
            .from(tbl_admin)
            .where(and(eq(tbl_admin.id, userId), eq(tbl_admin.isActive, true)))
            .limit(1);

        if (admin) return { id: userId, userType: 'admin' };

        const [superAdmin] = await db
            .select({ id: tbl_super_admin.id })
            .from(tbl_super_admin)
            .where(and(eq(tbl_super_admin.id, userId), eq(tbl_super_admin.isActive, true)))
            .limit(1);

        if (superAdmin) return { id: userId, userType: 'super_admin' };

        return null;
    } catch (err) {
        console.error('Auth error:', err);
        return null;
    }
}

// GET - Fetch all users (students/faculty)
export const GET: RequestHandler = async ({ request, url }) => {
    try {
        const user = await authenticateUser(request);
        if (!user) {
            throw error(401, { message: 'Unauthorized' });
        }

        const userType = url.searchParams.get('userType'); // 'student', 'faculty', or undefined for all

        let users = await db
            .select()
            .from(tbl_user)
            .where(eq(tbl_user.isActive, true));

        if (userType === 'student') {
            users = users.filter(u => u.userType === 'student');

            // Enrich with student data
            users = await Promise.all(
                users.map(async (u) => {
                    const [student] = await db
                        .select()
                        .from(tbl_student)
                        .where(eq(tbl_student.userId, u.id))
                        .limit(1);
                    return { ...u, studentData: student || null };
                })
            );
        } else if (userType === 'faculty') {
            users = users.filter(u => u.userType === 'faculty');

            // Enrich with faculty data
            users = await Promise.all(
                users.map(async (u) => {
                    const [faculty] = await db
                        .select()
                        .from(tbl_faculty)
                        .where(eq(tbl_faculty.userId, u.id))
                        .limit(1);
                    return { ...u, facultyData: faculty || null };
                })
            );
        } else {
            // Get both student and faculty data for all users
            users = await Promise.all(
                users.map(async (u) => {
                    let studentData = null;
                    let facultyData = null;
                    
                    if (u.userType === 'student') {
                        const [student] = await db
                            .select()
                            .from(tbl_student)
                            .where(eq(tbl_student.userId, u.id))
                            .limit(1);
                        studentData = student || null;
                    } else if (u.userType === 'faculty') {
                        const [faculty] = await db
                            .select()
                            .from(tbl_faculty)
                            .where(eq(tbl_faculty.userId, u.id))
                            .limit(1);
                        facultyData = faculty || null;
                    }
                    
                    return { ...u, studentData, facultyData };
                })
            );
        }

        return json({
            success: true,
            users
        });
    } catch (err: any) {
        console.error('GET /api/user error:', err);
        return json(
            { success: false, message: err.message || 'Failed to fetch users' },
            { status: err.status || 500 }
        );
    }
};

// POST - Create new user (student or faculty)
export const POST: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized' });
        }

        const body = await request.json();
        const {
            name,
            email,
            phone,
            username,
            password,
            userType = 'student', // 'student' or 'faculty'
            enrollmentNo,
            facultyNumber,
            course,
            year,
            department,
            gender,
            age,
            position
        } = body;

        if (!name || !username || !password || !userType) {
            throw error(400, { message: 'name, username, password, and userType are required' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const uniqueId = randomBytes(18).toString('hex');

        // Create user
        const [newUser] = await db
            .insert(tbl_user)
            .values({
                uniqueId,
                name,
                email: email || null,
                phone: phone || null,
                username,
                password: hashedPassword,
                userType,
                isActive: true
            })
            .returning();

        let profileData = null;

        // Create student or faculty profile
        if (userType === 'student') {
            if (!enrollmentNo) {
                throw error(400, { message: 'enrollmentNo is required for students' });
            }

            const [studentProfile] = await db
                .insert(tbl_student)
                .values({
                    userId: newUser.id,
                    enrollmentNo,
                    gender: gender || null,
                    age: age || null,
                    course: course || null,
                    year: year || null,
                    department: department || null
                })
                .returning();
            profileData = studentProfile;
        } else if (userType === 'faculty') {
            if (!facultyNumber) {
                throw error(400, { message: 'facultyNumber is required for faculty' });
            }

            const [facultyProfile] = await db
                .insert(tbl_faculty)
                .values({
                    userId: newUser.id,
                    facultyNumber,
                    gender: gender || null,
                    age: age || null,
                    department: department || null,
                    position: position || null
                })
                .returning();
            profileData = facultyProfile;
        }

        return json({
            success: true,
            message: 'User created successfully',
            data: { user: newUser, profile: profileData }
        });
    } catch (err: any) {
        console.error('POST /api/user error:', err);
        return json(
            { success: false, message: err.message || 'Failed to create user' },
            { status: err.status || 500 }
        );
    }
};

// PUT - Update user
export const PUT: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized' });
        }

        const body = await request.json();
        const { id, password, ...updateData } = body;

        if (!id) {
            throw error(400, { message: 'id is required' });
        }

        let updatePayload: any = updateData;

        // Hash password if provided
        if (password) {
            updatePayload.password = await bcrypt.hash(password, 10);
        }

        const [updatedUser] = await db
            .update(tbl_user)
            .set(updatePayload)
            .where(eq(tbl_user.id, id))
            .returning();

        return json({
            success: true,
            message: 'User updated successfully',
            data: updatedUser
        });
    } catch (err: any) {
        console.error('PUT /api/user error:', err);
        return json(
            { success: false, message: err.message || 'Failed to update user' },
            { status: err.status || 500 }
        );
    }
};

// DELETE - Deactivate user
export const DELETE: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin'].includes(user.userType)) {
            throw error(401, { message: 'Unauthorized - Admin only' });
        }

        const body = await request.json();
        const { id } = body;

        if (!id) {
            throw error(400, { message: 'id is required' });
        }

        const [deletedUser] = await db
            .update(tbl_user)
            .set({ isActive: false })
            .where(eq(tbl_user.id, id))
            .returning();

        return json({
            success: true,
            message: 'User deactivated successfully',
            data: deletedUser
        });
    } catch (err: any) {
        console.error('DELETE /api/user error:', err);
        return json(
            { success: false, message: err.message || 'Failed to delete user' },
            { status: err.status || 500 }
        );
    }
};
