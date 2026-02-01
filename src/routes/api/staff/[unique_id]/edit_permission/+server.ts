// File: /api/staff/[unique_id]/edit_permission/+server.ts
// DEPRECATED: Use PATCH /api/staff/[uniqueId]/permissions instead

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

// GET: Fetch staff permissions by uniqueId
export const GET: RequestHandler = async () => {
  return json(
    {
      success: false,
      message: 'This endpoint is deprecated. Use GET /api/staff/permissions instead.'
    },
    { status: 410 }
  );
};

// PATCH: Update staff permissions by uniqueId
export const PATCH: RequestHandler = async () => {
  return json(
    {
      success: false,
      message: 'This endpoint is deprecated. Use PATCH /api/staff/[uniqueId]/permissions instead.'
    },
    { status: 410 }
  );
};