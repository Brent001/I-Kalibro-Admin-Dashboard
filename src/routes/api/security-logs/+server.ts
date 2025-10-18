import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { securityLog, account, user } from '$lib/server/db/schema/schema.js';
import { desc, eq, and, gte, lte, or, like, sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, locals }) => {
    try {
        // Optional query parameters for filtering
        const eventType = url.searchParams.get('eventType');
        const userType = url.searchParams.get('userType'); // 'account' or 'user'
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const search = url.searchParams.get('search');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        // Build the query with joins to get user/account names and emails
        let query = db
            .select({
                id: securityLog.id,
                accountId: securityLog.accountId,
                userId: securityLog.userId,
                eventType: securityLog.eventType,
                eventTime: securityLog.eventTime,
                browser: securityLog.browser,
                ipAddress: securityLog.ipAddress,
                createdAt: securityLog.createdAt,
                // Account information
                accountName: account.name,
                accountEmail: account.email,
                accountUsername: account.username,
                accountRole: account.role, // <-- Add this line
                // User information
                userName: user.name,
                userEmail: user.email,
                userUsername: user.username,
                userRole: user.role, // <-- Add this line
            })
            .from(securityLog)
            .leftJoin(account, eq(securityLog.accountId, account.id))
            .leftJoin(user, eq(securityLog.userId, user.id))
            .orderBy(desc(securityLog.eventTime))
            .limit(limit)
            .offset(offset);

        // Apply filters (note: where conditions need to be applied before executing)
        const conditions = [];

        if (eventType && eventType !== 'all') {
            conditions.push(eq(securityLog.eventType, eventType));
        }

        if (userType === 'account') {
            conditions.push(sql`${securityLog.accountId} IS NOT NULL`);
        } else if (userType === 'user') {
            conditions.push(
                and(
                    sql`${securityLog.userId} IS NOT NULL`,
                    sql`${securityLog.accountId} IS NULL`
                )
            );
        }

        if (startDate) {
            conditions.push(gte(securityLog.eventTime, new Date(startDate)));
        }

        if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            conditions.push(lte(securityLog.eventTime, endDateTime));
        }

        if (search && search.trim()) {
            const searchPattern = `%${search.toLowerCase()}%`;
            conditions.push(
                or(
                    like(sql`LOWER(${securityLog.ipAddress})`, searchPattern),
                    like(sql`LOWER(${securityLog.browser})`, searchPattern),
                    like(sql`LOWER(${account.name})`, searchPattern),
                    like(sql`LOWER(${account.email})`, searchPattern),
                    like(sql`LOWER(${account.username})`, searchPattern),
                    like(sql`LOWER(${user.name})`, searchPattern),
                    like(sql`LOWER(${user.email})`, searchPattern),
                    like(sql`LOWER(${user.username})`, searchPattern)
                )
            );
        }

        // Execute query with conditions
        const logs = await (conditions.length > 0
            ? db
                  .select({
                      id: securityLog.id,
                      accountId: securityLog.accountId,
                      userId: securityLog.userId,
                      eventType: securityLog.eventType,
                      eventTime: securityLog.eventTime,
                      browser: securityLog.browser,
                      ipAddress: securityLog.ipAddress,
                      createdAt: securityLog.createdAt,
                      accountName: account.name,
                      accountEmail: account.email,
                      accountUsername: account.username,
                      userName: user.name,
                      userEmail: user.email,
                      userUsername: user.username,
                  })
                  .from(securityLog)
                  .leftJoin(account, eq(securityLog.accountId, account.id))
                  .leftJoin(user, eq(securityLog.userId, user.id))
                  .where(and(...conditions))
                  .orderBy(desc(securityLog.eventTime))
                  .limit(limit)
                  .offset(offset)
            : query);

        // Format the logs with proper user information
        const formattedLogs = logs.map((log) => ({
            id: log.id,
            accountId: log.accountId,
            userId: log.userId,
            eventType: log.eventType,
            eventTime: log.eventTime,
            browser: log.browser,
            ipAddress: log.ipAddress,
            createdAt: log.createdAt,
            // Use account info if accountId exists, otherwise use user info
            userName: log.accountName || log.userName || 'Unknown',
            userEmail: log.accountEmail || log.userEmail || null,
            userUsername: log.accountUsername || log.userUsername || null,
            role: log.accountRole || log.userRole || null, // <-- Add this line
        }));

        // Get total count for pagination
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(securityLog);

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
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
    try {
        const body = await request.json();
        const {
            accountId,
            userId,
            eventType,
            browser,
            ipAddress,
        } = body;

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

        if (!accountId && !userId) {
            return json(
                {
                    success: false,
                    error: 'Either accountId or userId is required',
                },
                { status: 400 }
            );
        }

        // Get IP address if not provided
        const clientIp = ipAddress || getClientAddress();

        // Insert the log
        const [newLog] = await db
            .insert(securityLog)
            .values({
                accountId: accountId || null,
                userId: userId || null,
                eventType,
                browser: browser || null,
                ipAddress: clientIp,
                eventTime: new Date(),
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
export const DELETE: RequestHandler = async ({ url }) => {
    try {
        const daysToKeep = parseInt(url.searchParams.get('daysToKeep') || '90');
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const deleted = await db
            .delete(securityLog)
            .where(lte(securityLog.createdAt, cutoffDate))
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