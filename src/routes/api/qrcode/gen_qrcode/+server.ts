import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
// QR token generation/management has been deprecated in this deployment.
// The system now uses student enrollment numbers or faculty numbers
// (stored in `tbl_student.enrollmentNo` and `tbl_faculty.facultyNumber`) instead.

export const GET: RequestHandler = async () => {
  return json({ success: false, message: 'QR token management is deprecated' }, { status: 410 });
};

export const POST: RequestHandler = async () => {
  return json({ success: false, message: 'QR token generation is deprecated' }, { status: 410 });
};

export const DELETE: RequestHandler = async () => {
  return json({ success: false, message: 'QR token deletion is deprecated' }, { status: 410 });
};