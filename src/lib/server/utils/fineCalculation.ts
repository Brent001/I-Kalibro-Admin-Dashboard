// $lib/server/utils/fineCalculation.ts
import { db } from '$lib/server/db/index.js';
import { tbl_book_borrowing, tbl_library_settings } from '$lib/server/db/schema/schema.js';
import { and, eq, lt, or, isNull } from 'drizzle-orm';

async function loadFineSettings(): Promise<any | null> {
  try {
    const rows = await db.select().from(tbl_library_settings).where(eq(tbl_library_settings.settingKey, 'fineCalculation')).limit(1);
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    if (r.dataType === 'json') {
      try { return JSON.parse(r.settingValue); } catch { return null; }
    }
    return null;
  } catch (err) {
    console.error('Failed to load fineCalculation settings:', err);
    return null;
  }
}

function isDateExempt(date: Date, settings: any | null) {
  if (!settings) return false;
  const ymd = date.toISOString().split('T')[0];
  if (settings.holidays && Array.isArray(settings.holidays)) {
    for (const h of settings.holidays) {
      if (h && h.date === ymd) return true;
    }
  }
  const wd = date.getDay();
  if (settings.closedWeekdays && Array.isArray(settings.closedWeekdays) && settings.closedWeekdays.includes(wd)) return true;
  if (settings.excludeSundays && wd === 0) return true;
  return false;
}

/**
 * Calculate fine based on hours overdue at ₱5 per hour, excluding exempt days/hours
 * @param dueDate - The due date of the borrowing
 * @param currentDate - The current date (defaults to now)
 * @returns Fine amount in pesos (₱5 per hour)
 */
export async function calculateFineAmount(dueDate: Date, currentDate: Date = new Date()): Promise<number> {
  if (currentDate <= dueDate) return 0;

  const settings = await loadFineSettings();

  const end = new Date(currentDate);
  const diffMs = end.getTime() - dueDate.getTime();
  let totalHoursElapsed = Math.ceil(diffMs / (1000 * 60 * 60));

  let exemptHours = 0;
  const cursor = new Date(dueDate);
  while (cursor < end) {
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);
    if (isDateExempt(dayStart, settings)) {
      exemptHours += 1;
    }
    cursor.setHours(cursor.getHours() + 1);
  }

  const totalNonExemptHours = Math.max(0, totalHoursElapsed - exemptHours);
  // ₱5 per hour — return in pesos directly
  const fineAmountPesos = totalNonExemptHours * 5;
  return fineAmountPesos;
}

/**
 * Calculate days overdue for display purposes
 * @param dueDate - The due date of the borrowing
 * @param currentDate - The current date (defaults to now)
 * @returns Number of days overdue
 */
export async function calculateDaysOverdue(dueDate: Date, currentDate: Date = new Date()): Promise<number> {
  const normalizedDueDate = new Date(dueDate);
  normalizedDueDate.setUTCHours(0, 0, 0, 0);
  const normalizedCurrentDate = new Date(currentDate);
  normalizedCurrentDate.setUTCHours(0, 0, 0, 0);

  if (normalizedCurrentDate <= normalizedDueDate) return 0;
  const settings = await loadFineSettings();
  const cursor = new Date(dueDate);
  cursor.setDate(cursor.getDate() + 1);
  cursor.setHours(0, 0, 0, 0);
  let count = 0;
  const end = new Date(currentDate);
  while (cursor <= end) {
    if (!isDateExempt(cursor, settings)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Update fines for a specific borrowing record
 * @param borrowingId - The borrowing record ID
 * @returns The updated fine amount in pesos
 */
export async function updateBorrowingFine(borrowingId: number): Promise<number> {
  try {
    const borrowing = await db
      .select()
      .from(tbl_book_borrowing)
      .where(eq(tbl_book_borrowing.id, borrowingId))
      .limit(1)
      .then(rows => rows[0]);

    if (!borrowing) {
      throw new Error(`Borrowing record ${borrowingId} not found`);
    }

    if (borrowing.status !== 'borrowed' && borrowing.status !== 'overdue') {
      return 0;
    }

    const dueDate = new Date(borrowing.dueDate);
    const currentDate = new Date();
    const calculatedFine = await calculateFineAmount(dueDate, currentDate);

    const newStatus = calculatedFine > 0 ? 'overdue' : borrowing.status;

    if (newStatus !== borrowing.status) {
      await db
        .update(tbl_book_borrowing)
        .set({
          status: newStatus,
          updatedAt: currentDate
        })
        .where(eq(tbl_book_borrowing.id, borrowingId));
    }

    return calculatedFine;
  } catch (error) {
    console.error(`Error updating fine for borrowing ${borrowingId}:`, error);
    throw error;
  }
}

/**
 * Update fines for all active borrowings
 * @returns Array of updated borrowing IDs and their fines in pesos
 */
export async function updateAllOverdueFines(): Promise<Array<{ id: number; fine: number }>> {
  try {
    const currentDate = new Date();

    const activeBorrowings = await db
      .select({
        id: tbl_book_borrowing.id,
        dueDate: tbl_book_borrowing.dueDate,
        status: tbl_book_borrowing.status
      })
      .from(tbl_book_borrowing)
      .where(
        and(
          or(
            eq(tbl_book_borrowing.status, 'borrowed'),
            eq(tbl_book_borrowing.status, 'overdue')
          ),
          isNull(tbl_book_borrowing.returnDate)
        )
      );

    const updates: Array<{ id: number; fine: number }> = [];

    for (const borrowing of activeBorrowings) {
      const dueDate = new Date(borrowing.dueDate);
      const calculatedFine = await calculateFineAmount(dueDate, currentDate);
      const newStatus = calculatedFine > 0 ? 'overdue' : 'borrowed';

      if (newStatus !== borrowing.status) {
        await db
          .update(tbl_book_borrowing)
          .set({
            status: newStatus,
            updatedAt: currentDate
          })
          .where(eq(tbl_book_borrowing.id, borrowing.id));
      }

      updates.push({ id: borrowing.id, fine: calculatedFine });
    }

    return updates;
  } catch (error) {
    console.error('Error updating all overdue fines:', error);
    throw error;
  }
}

/**
 * Get borrowing with calculated fine
 * @param borrowingId - The borrowing record ID
 * @returns Borrowing record with current fine calculated
 */
export async function getBorrowingWithFine(borrowingId: number) {
  await updateBorrowingFine(borrowingId);

  return await db
    .select()
    .from(tbl_book_borrowing)
    .where(eq(tbl_book_borrowing.id, borrowingId))
    .limit(1)
    .then(rows => rows[0]);
}