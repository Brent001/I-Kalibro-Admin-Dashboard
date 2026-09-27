import { db } from '$lib/server/db/index.js';
import { bookBorrowing } from '$lib/server/db/schema/schema.js';

async function updateFines() {
  const now = new Date();

  // Get all borrowings not yet returned and past due date
  const borrowings = await db
    .select()
    .from(bookBorrowing)
    .where(bookBorrowing.status.eq('borrowed'));

  for (const borrowing of borrowings) {
    const dueDate = new Date(borrowing.dueDate);
    if (now > dueDate) {
      const msPerHour = 1000 * 60 * 60;
      const overdueMs = now.getTime() - dueDate.getTime();
      const overdueHours = Math.ceil(overdueMs / msPerHour);
      const fine = overdueHours * 5;

      await db
        .update(bookBorrowing)
        .set({ fine, status: 'overdue' })
        .where(bookBorrowing.id.eq(borrowing.id));
    }
  }
}

updateFines().then(() => {
  console.log('Fines updated');
  process.exit(0);
});