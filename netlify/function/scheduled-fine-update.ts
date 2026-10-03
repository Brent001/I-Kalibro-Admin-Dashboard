// netlify/functions/scheduled-fine-update.ts
// This function will run automatically on a schedule
/// <reference types="node" />

import { schedule } from '@netlify/functions';

const CRON_SECRET = process.env.CRON_SECRET;
const SITE_URL = process.env.URL || 'http://localhost:5173';

const handler = schedule('0 * * * *', async () => {
  // Runs every hour (0 minutes past the hour)

  if (!CRON_SECRET || CRON_SECRET.length < 32 || /^<[^>]+>$/.test(CRON_SECRET)) {
    console.error('Scheduled fine update is missing a valid CRON_SECRET.');
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Scheduled job authentication is not configured' })
    };
  }
  
  try {
    console.log('Running scheduled fine update...');
    
    const response = await fetch(`${SITE_URL}/api/cron/update-fines`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Scheduled fine update completed:', result);

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Scheduled fine update failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
});

export { handler };