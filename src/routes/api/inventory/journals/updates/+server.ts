// src/routes/api/inventory/journals/updates/+server.ts

import { text } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db/index.js';
import { tbl_staff, tbl_admin, tbl_super_admin } from '$lib/server/db/schema/schema.js';
import { eq } from 'drizzle-orm';
import { isSessionRevoked } from '$lib/server/db/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

async function authenticateUser(request: Request): Promise<boolean> {
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
    if (!token) return false;
    
    if (await isSessionRevoked(token)) return false;
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id;
    if (!userId) return false;
    
    const [staff] = await db.select({ id: tbl_staff.id }).from(tbl_staff).where(eq(tbl_staff.id, userId)).limit(1);
    if (staff) return true;
    
    const [admin] = await db.select({ id: tbl_admin.id }).from(tbl_admin).where(eq(tbl_admin.id, userId)).limit(1);
    if (admin) return true;
    
    const [superAdmin] = await db.select({ id: tbl_super_admin.id }).from(tbl_super_admin).where(eq(tbl_super_admin.id, userId)).limit(1);
    if (superAdmin) return true;
    
    return false;
  } catch (err) {
    return false;
  }
}

export const GET: RequestHandler = async ({ request }) => {
  const isAuthorized = await authenticateUser(request);
  
  if (!isAuthorized) {
    return new Response('Unauthorized', { status: 401 });
  }

  let pingInterval: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (pingInterval) clearInterval(pingInterval);
    request.signal.removeEventListener('abort', cleanup);
  };

  const stream = new ReadableStream<string>({
    start(controller) {
      if (request.signal.aborted) return;

      // Send initial connection message
      controller.enqueue(': connected\n\n');

      // Set up keep-alive ping every 15 seconds
      request.signal.addEventListener('abort', cleanup, { once: true });
      pingInterval = setInterval(() => {
        if (closed || request.signal.aborted) {
          cleanup();
          return;
        }

        try {
          controller.enqueue(': ping\n\n');
        } catch {
          cleanup();
        }
      }, 15000);
    },
    cancel() {
      cleanup();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
};
