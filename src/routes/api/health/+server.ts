import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { sql } from 'drizzle-orm';

async function checkDatabaseConnection(): Promise<{ status: 'ok' | 'error', responseTime: number }> {
    const startTime = Date.now();
    try {
        // Set a timeout for the database query (5 seconds)
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Database query timeout')), 5000);
        });

        const queryPromise = db.execute(sql`SELECT 1 as health_check`);

        // Race between the query and timeout
        await Promise.race([queryPromise, timeoutPromise]);

        const responseTime = Date.now() - startTime;
        return { status: 'ok', responseTime };
    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error('Database connection check failed:', error instanceof Error ? error.message : String(error));
        return { status: 'error', responseTime };
    }
}

async function checkMemoryUsage(): Promise<{ status: 'ok' | 'error', usage: number }> {
    try {
        const memUsage = process.memoryUsage();
        const usageMB = memUsage.heapUsed / 1024 / 1024;
        // Consider it an error if memory usage is over 500MB (arbitrary threshold)
        return { status: usageMB > 500 ? 'error' : 'ok', usage: Math.round(usageMB) };
    } catch (error) {
        return { status: 'error', usage: 0 };
    }
}

async function checkServerLoad(): Promise<{ status: 'ok' | 'error', load: number[] }> {
    try {
        // Get system load average (1, 5, 15 minute averages)
        const load = require('os').loadavg();
        // Consider high load if 1-minute average > number of CPU cores
        const cpuCount = require('os').cpus().length;
        return { status: load[0] > cpuCount ? 'error' : 'ok', load: load.map((l: number) => Math.round(l * 100) / 100) };
    } catch (error) {
        return { status: 'error', load: [0, 0, 0] };
    }
}

export const GET: RequestHandler = async () => {
    // Test multiple system components with timeout protection
    const checkTimeout = 10000; // 10 seconds total timeout

    try {
        const checksPromise = Promise.all([
            checkDatabaseConnection(),
            checkMemoryUsage(),
            checkServerLoad()
        ]);

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Health check timeout')), checkTimeout);
        });

        const checks = await Promise.race([checksPromise, timeoutPromise]) as any[];

        const dbCheck = checks[0];
        const memCheck = checks[1];
        const loadCheck = checks[2];

        // Calculate overall health score
        const checkResults = [dbCheck.status, memCheck.status, loadCheck.status];
        const successfulChecks = checkResults.filter(status => status === 'ok').length;
        const totalChecks = checkResults.length;
        const successRate = (successfulChecks / totalChecks) * 100;

        // Overall status: healthy if at least 2/3 checks pass
        const overallStatus = successRate >= 67 ? 'healthy' : successRate >= 33 ? 'degraded' : 'unhealthy';

        return json({
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            checks: {
                database: dbCheck,
                memory: memCheck,
                serverLoad: loadCheck
            },
            summary: {
                total: totalChecks,
                successful: successfulChecks,
                successRate: Math.round(successRate)
            }
        });
    } catch (error) {
        console.error('Health check failed:', error instanceof Error ? error.message : String(error));
        // Return degraded status if health check itself fails
        return json({
            status: 'degraded',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            error: 'Health check timed out or failed',
            checks: {
                database: { status: 'error', responseTime: checkTimeout },
                memory: { status: 'error', usage: 0 },
                serverLoad: { status: 'error', load: [0, 0, 0] }
            },
            summary: {
                total: 3,
                successful: 0,
                successRate: 0
            }
        });
    }
};