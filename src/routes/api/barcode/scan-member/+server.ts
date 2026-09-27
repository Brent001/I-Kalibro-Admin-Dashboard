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

interface MemberInfo {
    userId: number;
    memberNumber: string;
    department: string;
    userName: string;
    userEmail: string;
    memberType: 'student' | 'faculty';
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
 * Search for a member (student or faculty) by their ID number
 */
async function findMemberByBarcode(barcode: string): Promise<MemberInfo | null> {
    const cleanBarcode = barcode.trim();
    
    // Try to find student first
    const studentResult = await db
        .select({
            userId: tbl_student.userId,
            enrollmentNo: tbl_student.enrollmentNo,
            department: tbl_student.department,
            userName: tbl_user.name,
            userEmail: tbl_user.email
        })
        .from(tbl_student)
        .innerJoin(tbl_user, eq(tbl_student.userId, tbl_user.id))
        .where(eq(sql`LOWER(${tbl_student.enrollmentNo})`, cleanBarcode.toLowerCase()))
        .limit(1);

    if (studentResult.length > 0) {
        const student = studentResult[0];
        return {
            userId: student.userId,
            memberNumber: student.enrollmentNo,
            department: student.department || 'N/A',
            userName: student.userName,
            userEmail: student.userEmail || '',
            memberType: 'student'
        };
    }

    // If no student found, try to find faculty
    const facultyResult = await db
        .select({
            userId: tbl_faculty.userId,
            facultyNumber: tbl_faculty.facultyNumber,
            department: tbl_faculty.department,
            userName: tbl_user.name,
            userEmail: tbl_user.email
        })
        .from(tbl_faculty)
        .innerJoin(tbl_user, eq(tbl_faculty.userId, tbl_user.id))
        .where(eq(sql`LOWER(${tbl_faculty.facultyNumber})`, cleanBarcode.toLowerCase()))
        .limit(1);

    if (facultyResult.length > 0) {
        const faculty = facultyResult[0];
        return {
            userId: faculty.userId,
            memberNumber: faculty.facultyNumber,
            department: faculty.department || 'N/A',
            userName: faculty.userName,
            userEmail: faculty.userEmail || '',
            memberType: 'faculty'
        };
    }

    return null;
}

/**
 * Handle time-in action
 */
async function handleTimeIn(member: MemberInfo, purpose?: string) {
    // Check if user already has an active time-in
    const [activeVisit] = await db
        .select()
        .from(tbl_library_visit)
        .where(
            and(
                eq(tbl_library_visit.userId, member.userId),
                isNull(tbl_library_visit.timeOut)
            )
        )
        .orderBy(desc(tbl_library_visit.timeIn))
        .limit(1);

    if (activeVisit) {
        return {
            success: false,
            message: `${member.userName} is already timed in. Please time out first.`,
            status: 409
        };
    }

    // Create new visit record
    await db.insert(tbl_library_visit).values({
        userId: member.userId,
        visitorName: member.userName,
        visitorType: member.memberType,
        purpose: purpose || 'Library Access',
        timeIn: new Date(),
        timeOut: null
    });

    const greeting = member.memberType === 'faculty' 
        ? `Welcome, Dr. ${member.userName}!` 
        : `Welcome, ${member.userName}!`;

    return {
        success: true,
        message: greeting,
        memberType: member.memberType,
        memberNumber: member.memberNumber,
        memberName: member.userName,
        department: member.department,
        email: member.userEmail,
        status: 200
    };
}

/**
 * Handle time-out action
 */
async function handleTimeOut(member: MemberInfo, purpose?: string) {
    // Find active visit
    const [activeVisit] = await db
        .select()
        .from(tbl_library_visit)
        .where(
            and(
                eq(tbl_library_visit.userId, member.userId),
                isNull(tbl_library_visit.timeOut)
            )
        )
        .orderBy(desc(tbl_library_visit.timeIn))
        .limit(1);

    if (!activeVisit) {
        return {
            success: false,
            message: `No active time-in found for ${member.userName}.`,
            status: 404
        };
    }

    // Update visit with time-out
    const timeOutTs = new Date();
    await db
        .update(tbl_library_visit)
        .set({ 
            timeOut: timeOutTs,
            purpose: purpose || activeVisit.purpose 
        })
        .where(eq(tbl_library_visit.id, activeVisit.id));

    const farewell = member.memberType === 'faculty'
        ? `Goodbye, Dr. ${member.userName}!`
        : `Goodbye, ${member.userName}!`;

    return {
        success: true,
        message: farewell,
        memberType: member.memberType,
        memberNumber: member.memberNumber,
        memberName: member.userName,
        department: member.department,
        email: member.userEmail,
        timeIn: activeVisit.timeIn,
        timeOut: timeOutTs,
        status: 200
    };
}

/**
 * POST endpoint for barcode scanning
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        // Allow hardware devices to authenticate via a shared key header
        const HARDWARE_KEY = process.env.BARCODE_HARDWARE_KEY || process.env.BARCODE_HARDWARE_TOKEN || '';
        const hwKeyHeader = request.headers.get('x-hardware-key') || request.headers.get('x-api-key') || '';

        // Try to authenticate normal user via JWT/cookie
        let user = await authenticateUser(request);

        // If no user but hardware key matches, treat as an authorized staff-level request
        const isHardware = HARDWARE_KEY && hwKeyHeader && HARDWARE_KEY === hwKeyHeader;
        if (!user && !isHardware) {
            return json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body (support JSON and form submissions)
        let barcode: string | undefined;
        let action: string | undefined;
        let purpose: string | undefined;

        try {
            const data = await request.json();
            barcode = data?.barcode;
            action = data?.action;
            purpose = data?.purpose;
        } catch (e) {
            // Not JSON - try form data
            try {
                const fd = await request.formData();
                barcode = fd.get('barcode') as string | undefined;
                action = (fd.get('action') as string) || undefined;
                purpose = (fd.get('purpose') as string) || undefined;
            } catch (e2) {
                // as a last resort, try to parse raw text
                try {
                    const txt = await request.text();
                    const parsed = txt ? JSON.parse(txt) : {};
                    barcode = parsed?.barcode;
                    action = parsed?.action;
                    purpose = parsed?.purpose;
                } catch (e3) {
                    // leave undefined
                }
            }
        }

        // Validate barcode
        if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
            return json(
                { success: false, message: 'Invalid barcode provided' },
                { status: 400 }
            );
        }

        // Validate action
        if (!action || (action !== 'time_in' && action !== 'time_out')) {
            return json(
                { success: false, message: 'Invalid action. Must be "time_in" or "time_out"' },
                { status: 400 }
            );
        }

        // Find member by barcode (works for both student enrollment no. and faculty number)
        const member = await findMemberByBarcode(barcode);

        if (!member) {
            return json(
                {
                    success: false,
                    message: `Member not found. Please verify the barcode/ID number and try again.`,
                    memberType: 'unknown'
                },
                { status: 404 }
            );
        }

        // Process the action
        let result;
        if (action === 'time_in') {
            result = await handleTimeIn(member, purpose);
        } else {
            result = await handleTimeOut(member, purpose);
        }

        return json(result, { status: result.status });

    } catch (err) {
        console.error('Barcode scan error:', err);
        return json(
            { success: false, message: 'Failed to process barcode scan' },
            { status: 500 }
        );
    }
};