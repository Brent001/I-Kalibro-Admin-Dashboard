// $lib/server/utils/fineCalculation.ts
import { db } from '$lib/server/db/index.js';
import { tbl_book_borrowing } from '$lib/server/db/schema/schema.js';
import { and, eq, lt, or, isNull } from 'drizzle-orm';

/**
 * Calculate fine based on hours overdue at ₱5 per hour
 * @param dueDate - The due date of the borrowing
 * @param currentDate - The current date (defaults to now)
 * @returns Fine amount in centavos (₱5 = 500 centavos)
 */
export function calculateFineAmount(dueDate: Date, currentDate: Date = new Date()): number {
  // No fine if not overdue
  if (currentDate <= dueDate) {
    return 0;
  }

  // Calculate hours overdue
  const millisecondsOverdue = currentDate.getTime() - dueDate.getTime();
  const hoursOverdue = Math.ceil(millisecondsOverdue / (1000 * 60 * 60));

  // ₱5 per hour = 500 centavos per hour
  const fineCentavos = hoursOverdue * 500;

  return fineCentavos;
}

/**
 * Calculate days overdue for display purposes
 * @param dueDate - The due date of the borrowing
 * @param currentDate - The current date (defaults to now)
 * @returns Number of days overdue
 */
export function calculateDaysOverdue(dueDate: Date, currentDate: Date = new Date()): number {
  if (currentDate <= dueDate) {
    return 0;
  }

  const millisecondsOverdue = currentDate.getTime() - dueDate.getTime();
  const daysOverdue = Math.floor(millisecondsOverdue / (1000 * 60 * 60 * 24));

  return daysOverdue;
}

/**
 * Update fines for a specific borrowing record
 * @param borrowingId - The borrowing record ID
 * @returns The updated fine amount in centavos
 */
export async function updateBorrowingFine(borrowingId: number): Promise<number> {
  try {
    // Get the borrowing record
    const borrowing = await db
      .select()
      .from(tbl_book_borrowing)
      .where(eq(tbl_book_borrowing.id, borrowingId))
      .limit(1)
      .then(rows => rows[0]);

    if (!borrowing) {
      throw new Error(`Borrowing record ${borrowingId} not found`);
    }

    // Only calculate fines for active borrowed/overdue books
    if (borrowing.status !== 'borrowed' && borrowing.status !== 'overdue') {
      return 0;
    }

    const dueDate = new Date(borrowing.dueDate);
    const currentDate = new Date();
    const calculatedFine = calculateFineAmount(dueDate, currentDate);

    // Update the status if overdue
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
 * This should be called periodically or before displaying reports
 * @returns Array of updated borrowing IDs and their fines
 */
export async function updateAllOverdueFines(): Promise<Array<{ id: number; fine: number }>> {
  try {
    const currentDate = new Date();
    
    // Get all active borrowings that are potentially overdue
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

    // Update each borrowing in a batch
    for (const borrowing of activeBorrowings) {
      const dueDate = new Date(borrowing.dueDate);
      const calculatedFine = calculateFineAmount(dueDate, currentDate);
      const newStatus = calculatedFine > 0 ? 'overdue' : 'borrowed';

      // Only update status if it needs updating
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