import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import {
    tbl_user,
    tbl_student,
    tbl_faculty,
    tbl_library_visit
} from '$lib/server/db/schema/schema.js';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

interface AuthenticatedUser {
    id: number;
    userType: 'super_admin' | 'admin' | 'staff' | 'user';
}

interface VisitInfo {
    id: number;
    userId: number | null;
    visitorName: string | null;
    visitorType: 'student' | 'faculty' | null;
    purpose: string | null;
    timeIn: string;
    timeOut: string | null;
    memberNumber: string;
    department: string;
}

/**
 * Authenticate user from request headers or cookies
 */
async function authenticateUser(request: Request): Promise<AuthenticatedUser | null> {
    try {
        let token: string | null = null;

        // Try Authorization header first
        const authHeader = request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }

        // Fallback to cookie
        if (!token) {
            const cookieHeader = request.headers.get('cookie');
            if (cookieHeader) {
                const cookies = Object.fromEntries(
                    cookieHeader.split('; ').map(c => c.split('='))
                );
                token = cookies.token;
            }
        }

        if (!token) {
            return null;
        }

        const decoded = jwt.verify(token, JWT_SECRET) as {
            userId: number;
            userType: 'super_admin' | 'admin' | 'staff' | 'user';
        };

        if (await isSessionRevoked(token)) {
            return null;
        }

        return {
            id: decoded.userId,
            userType: decoded.userType
        };
    } catch {
        return null;
    }
}

/**
 * Get member info by user ID
 */
async function getMemberInfo(userId: number): Promise<{ memberNumber: string; department: string; memberType: 'student' | 'faculty' } | null> {
    // Try student first
    const student = await db
        .select({
            enrollmentNo: tbl_student.enrollmentNo,
            department: tbl_student.department
        })
        .from(tbl_student)
        .where(eq(tbl_student.userId, userId))
        .limit(1);

    if (student.length > 0) {
        return {
            memberNumber: student[0].enrollmentNo,
            department: student[0].department || 'N/A',
            memberType: 'student'
        };
    }

    // Try faculty
    const faculty = await db
        .select({
            facultyNumber: tbl_faculty.facultyNumber,
            department: tbl_faculty.department
        })
        .from(tbl_faculty)
        .where(eq(tbl_faculty.userId, userId))
        .limit(1);

    if (faculty.length > 0) {
        return {
            memberNumber: faculty[0].facultyNumber,
            department: faculty[0].department || 'N/A',
            memberType: 'faculty'
        };
    }

    return null;
}

export const GET: RequestHandler = async ({ request }) => {
    try {
        const user = await authenticateUser(request);
        if (!user || !['super_admin', 'admin', 'staff'].includes(user.userType)) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Get recent visits (last 20)
        const visits = await db
            .select({
                id: tbl_library_visit.id,
                userId: tbl_library_visit.userId,
                visitorName: tbl_library_visit.visitorName,
                visitorType: tbl_library_visit.visitorType,
                purpose: tbl_library_visit.purpose,
                timeIn: tbl_library_visit.timeIn,
                timeOut: tbl_library_visit.timeOut
            })
            .from(tbl_library_visit)
            .orderBy(desc(tbl_library_visit.timeIn))
            .limit(20);

        // Format visits with member info
        const formattedVisits: VisitInfo[] = [];
        const stats = {
            totalScans: 0,
            studentsScanned: 0,
            facultyScanned: 0
        };

        for (const visit of visits) {
            if (visit.userId === null) continue; // Ensure userId is not null
            
            const memberInfo = await getMemberInfo(visit.userId);
            if (memberInfo) {
                formattedVisits.push({
                    id: visit.id,
                    userId: visit.userId,
                    visitorName: visit.visitorName,
                    visitorType: visit.visitorType as 'student' | 'faculty' | null, // Cast to expected type
                    purpose: visit.purpose,
                    timeIn: visit.timeIn.toISOString(),
                    timeOut: visit.timeOut?.toISOString() || null,
                    memberNumber: memberInfo.memberNumber,
                    department: memberInfo.department
                });

                // Update stats
                stats.totalScans++;
                if (memberInfo.memberType === 'student') {
                    stats.studentsScanned++;
                } else {
                    stats.facultyScanned++;
                }
            }
        }

        return json({
            success: true,
            data: formattedVisits,
            stats
        });
    } catch (error) {
        console.error('Error fetching recent scans:', error);
        return json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
};