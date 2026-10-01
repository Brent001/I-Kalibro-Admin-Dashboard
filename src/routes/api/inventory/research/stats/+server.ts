import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { and, count, eq, gt, lt, sum } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { tbl_category, tbl_thesis, tbl_thesis_borrowing } from '$lib/server/db/schema/schema.js';
import { verifyToken } from '$lib/server/db/auth.js';

export const GET: RequestHandler = async ({ cookies }) => {
  const user = await verifyToken(cookies.get('token') || '');
  if (!user || !['admin', 'super_admin', 'staff'].includes(user.userType)) throw error(401, 'Unauthorized');

  const [[recordTotal], [availableTotal], [borrowedTotal], [categoryTotal], [lowStockTotal], [outOfStockTotal]] = await Promise.all([
    db.select({ value: count() }).from(tbl_thesis).where(eq(tbl_thesis.isActive, true)),
    db.select({ value: sum(tbl_thesis.availableCopies) }).from(tbl_thesis).where(eq(tbl_thesis.isActive, true)),
    db.select({ value: count() }).from(tbl_thesis_borrowing).where(eq(tbl_thesis_borrowing.status, 'borrowed')),
    db.select({ value: count() }).from(tbl_category).where(eq(tbl_category.itemType, 'thesis')),
    db.select({ value: count() }).from(tbl_thesis).where(and(eq(tbl_thesis.isActive, true), gt(tbl_thesis.availableCopies, 0), lt(tbl_thesis.availableCopies, 3))),
    db.select({ value: count() }).from(tbl_thesis).where(and(eq(tbl_thesis.isActive, true), eq(tbl_thesis.availableCopies, 0)))
  ]);

  const totalResearch = Number(recordTotal?.value || 0);
  const availableCopies = Number(availableTotal?.value || 0);
  const borrowedResearch = Number(borrowedTotal?.value || 0);
  const totalPhysicalCopies = availableCopies + borrowedResearch;
  const utilization = totalPhysicalCopies ? Math.round((borrowedResearch / totalPhysicalCopies) * 100) : 0;
  const availability = totalResearch ? Math.round((availableCopies / totalResearch) * 100) : 0;

  return json({ success: true, data: {
    totalResearch, totalTheses: totalResearch, totalBooks: totalResearch, totalJournals: totalResearch,
    availableCopies, borrowedResearch, borrowedBooks: borrowedResearch, borrowedJournals: borrowedResearch,
    categoriesCount: Number(categoryTotal?.value || 0), lowStock: Number(lowStockTotal?.value || 0),
    outOfStock: Number(outOfStockTotal?.value || 0), totalPhysicalCopies, utilization, utilizationRate: utilization,
    availability, availabilityRate: availability
  } });
};
