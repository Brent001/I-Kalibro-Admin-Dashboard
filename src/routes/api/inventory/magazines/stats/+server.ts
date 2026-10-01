import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { and, count, eq, gt, lt, sum } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { tbl_category, tbl_magazine, tbl_magazine_borrowing } from '$lib/server/db/schema/schema.js';
import { verifyToken } from '$lib/server/db/auth.js';

export const GET: RequestHandler = async ({ cookies }) => {
  const user = await verifyToken(cookies.get('token') || '');
  if (!user || !['admin', 'super_admin', 'staff'].includes(user.userType)) throw error(401, 'Unauthorized');

  const [[magazineTotal], [availableTotal], [borrowedTotal], [categoryTotal], [lowStockTotal], [outOfStockTotal]] = await Promise.all([
    db.select({ value: count() }).from(tbl_magazine).where(eq(tbl_magazine.isActive, true)),
    db.select({ value: sum(tbl_magazine.availableCopies) }).from(tbl_magazine).where(eq(tbl_magazine.isActive, true)),
    db.select({ value: count() }).from(tbl_magazine_borrowing).where(eq(tbl_magazine_borrowing.status, 'borrowed')),
    db.select({ value: count() }).from(tbl_category).where(eq(tbl_category.itemType, 'magazine')),
    db.select({ value: count() }).from(tbl_magazine).where(and(eq(tbl_magazine.isActive, true), gt(tbl_magazine.availableCopies, 0), lt(tbl_magazine.availableCopies, 3))),
    db.select({ value: count() }).from(tbl_magazine).where(and(eq(tbl_magazine.isActive, true), eq(tbl_magazine.availableCopies, 0)))
  ]);

  const totalMagazines = Number(magazineTotal?.value || 0);
  const availableCopies = Number(availableTotal?.value || 0);
  const borrowedMagazines = Number(borrowedTotal?.value || 0);
  const totalPhysicalCopies = availableCopies + borrowedMagazines;
  const utilization = totalPhysicalCopies ? Math.round((borrowedMagazines / totalPhysicalCopies) * 100) : 0;
  const availability = totalMagazines ? Math.round((availableCopies / totalMagazines) * 100) : 0;

  return json({ success: true, data: {
    totalMagazines, availableCopies, borrowedMagazines, categoriesCount: Number(categoryTotal?.value || 0),
    lowStock: Number(lowStockTotal?.value || 0), outOfStock: Number(outOfStockTotal?.value || 0), totalPhysicalCopies,
    utilization, utilizationRate: utilization, availability, availabilityRate: availability
  } });
};
