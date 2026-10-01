import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { randomBytes } from 'node:crypto';
import { isSessionRevoked, verifyToken } from '$lib/server/db/auth.js';
import { uploadCoverPhotoToB2 } from '$lib/server/utils/backblazeUpload.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const token = cookies.get('token');
  const user = token && !(await isSessionRevoked(token)) ? await verifyToken(token) : null;
  if (!user || !['admin', 'super_admin', 'staff'].includes(user.userType)) {
    throw error(401, 'Unauthorized');
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const uploadType = formData.get('type');
  if (!(file instanceof File) || uploadType !== 'book-cover') {
    throw error(400, 'A book cover image is required.');
  }
  if (!file.type.startsWith('image/')) throw error(400, 'File must be an image.');
  if (file.size > 5 * 1024 * 1024) throw error(400, 'Cover images must be smaller than 5 MB.');

  const extension = file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '';
  const fileName = `${Date.now()}-${randomBytes(6).toString('hex')}${extension}`;
  const url = await uploadCoverPhotoToB2(fileName, Buffer.from(await file.arrayBuffer()), file.type, 'book');

  return json({ success: true, data: { url }, message: 'Cover photo uploaded successfully.' });
};
