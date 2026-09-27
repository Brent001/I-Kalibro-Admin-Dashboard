import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_security_log, tbl_staff, tbl_super_admin, tbl_admin, tbl_user } from '$lib/server/db/schema/schema.js';
import { desc, eq, and, gte, lte, or, like, sql } from 'drizzle-orm';
import { verifyToken } from '$lib/server/db/auth.js';

export const GET: RequestHandler = async ({ url, cookies }) => {
    try {
        const token = cookies.get('token');
        const user = token ? await verifyToken(token) : null;
        if (!user) return json({ success: false, error: 'Unauthorized' }, { status: 401 });

        const currentUserId = user.id;
        const currentUserType = user.userType;

        // Optional query parameters for filtering
        const eventType = url.searchParams.get('eventType');
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const search = url.searchParams.get('search');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        // Build the query with joins to get user/staff names and emails from all tables
        const getBaseQuery = () => {
            return db
                .select({
                    id: tbl_security_log.id,
                    userId: tbl_security_log.userId,
                    userType: tbl_security_log.userType,
                    eventType: tbl_security_log.eventType,
                    ipAddress: tbl_security_log.ipAddress,
                    userAgent: tbl_security_log.userAgent,
                    timestamp: tbl_security_log.timestamp,
                    // Coalesce user information from all possible tables
                    userName: sql<string>`COALESCE(${tbl_super_admin.name}, ${tbl_admin.name}, ${tbl_staff.name}, ${tbl_user.name})`,
                    userEmail: sql<string>`COALESCE(${tbl_super_admin.email}, ${tbl_admin.email}, ${tbl_staff.email}, ${tbl_user.email})`,
                    userUsername: sql<string>`COALESCE(${tbl_super_admin.username}, ${tbl_admin.username}, ${tbl_staff.username}, ${tbl_user.username})`,
                })
                .from(tbl_security_log)
                .leftJoin(tbl_super_admin, and(eq(tbl_security_log.userId, tbl_super_admin.id), eq(tbl_security_log.userType, 'super_admin')))
                .leftJoin(tbl_admin, and(eq(tbl_security_log.userId, tbl_admin.id), eq(tbl_security_log.userType, 'admin')))
                .leftJoin(tbl_staff, and(eq(tbl_security_log.userId, tbl_staff.id), eq(tbl_security_log.userType, 'staff')))
                .leftJoin(tbl_user, and(eq(tbl_security_log.userId, tbl_user.id), or(eq(tbl_security_log.userType, 'user'), eq(tbl_security_log.userType, 'student'), eq(tbl_security_log.userType, 'faculty'))));
        };

        // Apply filters (note: where conditions need to be applied before executing)
        const conditions = [];

        // Role-based access control for logs
        if (currentUserType === 'super_admin') {
            // Super admin sees all logs - no filter needed
        } else if (currentUserType === 'admin' && currentUserId !== null) {
            // Admin sees: his own logs + all staff logs
            conditions.push(
                or(
                    and(eq(tbl_security_log.userId, currentUserId), eq(tbl_security_log.userType, 'admin')),
                    eq(tbl_security_log.userType, 'staff')
                )
            );
        } else if (currentUserType === 'staff' && currentUserId !== null) {
            // Staff sees only his own logs
            conditions.push(and(eq(tbl_security_log.userId, currentUserId), eq(tbl_security_log.userType, 'staff')));
        } else if (currentUserId !== null && currentUserType) {
            // Regular users see only their own logs
            conditions.push(and(eq(tbl_security_log.userId, currentUserId), eq(tbl_security_log.userType, currentUserType)));
        }

        if (eventType && eventType !== 'all') {
            conditions.push(eq(tbl_security_log.eventType, eventType));
        }

        if (startDate) {
            conditions.push(gte(tbl_security_log.timestamp, new Date(startDate)));
        }

        if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            conditions.push(lte(tbl_security_log.timestamp, endDateTime));
        }

        if (search && search.trim()) {
            const searchPattern = `%${search.toLowerCase()}%`;
            conditions.push(
                or(
                    like(sql`LOWER(${tbl_security_log.ipAddress})`, searchPattern),
                    like(sql`LOWER(COALESCE(${tbl_super_admin.name}, ${tbl_admin.name}, ${tbl_staff.name}, ${tbl_user.name}))`, searchPattern),
                    like(sql`LOWER(COALESCE(${tbl_super_admin.email}, ${tbl_admin.email}, ${tbl_staff.email}, ${tbl_user.email}))`, searchPattern),
                    like(sql`LOWER(COALESCE(${tbl_super_admin.username}, ${tbl_admin.username}, ${tbl_staff.username}, ${tbl_user.username}))`, searchPattern)
                )
            );
        }

        // Execute query with conditions
        let finalQuery = getBaseQuery();
        if (conditions.length > 0) {
            finalQuery = finalQuery.where(and(...conditions)) as any;
        }

        const logs = await finalQuery
            .orderBy(desc(tbl_security_log.timestamp))
            .limit(limit)
            .offset(offset);

        // Format the logs with proper user information for the frontend
        const formattedLogs = logs.map((log) => ({
            id: log.id,
            userId: log.userId,
            userType: log.userType,
            eventType: log.eventType,
            ipAddress: log.ipAddress || 'N/A',
            browser: log.userAgent || 'N/A', // Browser info from userAgent
            eventTime: log.timestamp,
            createdAt: log.timestamp,
            userName: log.userName || 'Unknown',
            userEmail: log.userEmail || 'N/A',
            userUsername: log.userUsername || 'N/A',
            role: log.userType // Map userType to role for frontend
        }));

        // Get total count for pagination
        let countQuery = db
            .select({ count: sql<number>`count(*)` })
            .from(tbl_security_log);
        if (conditions.length > 0) {
            countQuery = db
                .select({ count: sql<number>`count(*)` })
                .from(tbl_security_log)
                .leftJoin(tbl_super_admin, and(eq(tbl_security_log.userId, tbl_super_admin.id), eq(tbl_security_log.userType, 'super_admin')))
                .leftJoin(tbl_admin, and(eq(tbl_security_log.userId, tbl_admin.id), eq(tbl_security_log.userType, 'admin')))
                .leftJoin(tbl_staff, and(eq(tbl_security_log.userId, tbl_staff.id), eq(tbl_security_log.userType, 'staff')))
                .leftJoin(tbl_user, and(eq(tbl_security_log.userId, tbl_user.id), or(eq(tbl_security_log.userType, 'user'), eq(tbl_security_log.userType, 'student'), eq(tbl_security_log.userType, 'faculty'))))
                .where(and(...conditions)) as any;
        }

        const countResult = await countQuery;

        const totalCount = Number(countResult[0]?.count || 0);

        return json({
            success: true,
            data: {
                logs: formattedLogs,
                total: totalCount,
                limit,
                offset,
            },
        });
    } catch (error) {
        console.error('Error fetching security logs:', error);
        return json(
            {
                success: false,
                error: 'Failed to fetch security logs',
            },
            { status: 500 }
        );
    }
};

// Optional: POST endpoint to create security log entries
export const POST: RequestHandler = async ({ request, getClientAddress, cookies }) => {
    try {
        const token = cookies.get('token');
        const user = token ? await verifyToken(token) : null;
        if (!user || !['admin', 'super_admin'].includes(user.userType)) {
            return json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { eventType, ipAddress } = body;

        // Validation
        if (!eventType) {
            return json(
                {
                    success: false,
                    error: 'Event type is required',
                },
                { status: 400 }
            );
        }

        // Get IP address if not provided
        const clientIp = ipAddress || getClientAddress();

        // Insert the log
        const [newLog] = await db
            .insert(tbl_security_log)
            .values({
                userId: user.id,
                userType: user.userType,
                eventType,
                ipAddress: clientIp,
                timestamp: new Date(),
            })
            .returning();

        return json({
            success: true,
            data: { log: newLog },
        });
    } catch (error) {
        console.error('Error creating security log:', error);
        return json(
            {
                success: false,
                error: 'Failed to create security log',
            },
            { status: 500 }
        );
    }
};

// Optional: DELETE endpoint to clean up old logs
export const DELETE: RequestHandler = async ({ url, cookies }) => {
    try {
        const token = cookies.get('token');
        const user = token ? await verifyToken(token) : null;
        if (!user || user.userType !== 'super_admin') {
            return json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const daysToKeep = parseInt(url.searchParams.get('daysToKeep') || '90');
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const deleted = await db
            .delete(tbl_security_log)
            .where(lte(tbl_security_log.timestamp, cutoffDate))
            .returning();

        return json({
            success: true,
            data: {
                deletedCount: deleted.length,
                cutoffDate,
            },
        });
    } catch (error) {
        console.error('Error deleting old security logs:', error);
        return json(
            {
                success: false,
                error: 'Failed to delete old security logs',
            },
            { status: 500 }
        );
    }
};