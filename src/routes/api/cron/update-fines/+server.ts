// src/routes/api/cron/update-fines/+server.ts
// This endpoint can be called by Netlify scheduled functions or external cron services

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { updateAllOverdueFines } from '$lib/server/utils/fineCalculation.js';

// Secret token to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-token-here';

export const GET: RequestHandler = async ({ request }) => {
  try {
    // Verify authorization token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token !== CRON_SECRET) {
      throw error(401, { message: 'Unauthorized' });
    }

    console.log('Starting scheduled fine update...');
    const startTime = Date.now();

    // Update all overdue fines
    const updates = await updateAllOverdueFines();

    const duration = Date.now() - startTime;

    console.log(`Fine update completed in ${duration}ms. Updated ${updates.length} records.`);

    return json({
      success: true,
      message: 'Fines updated successfully',
      data: {
        recordsUpdated: updates.length,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('Error in cron job:', err);
    throw error(500, { 
      message: err instanceof Error ? err.message : 'Internal server error' 
    });
  }
};

// Also support POST method
export const POST: RequestHandler = GET;