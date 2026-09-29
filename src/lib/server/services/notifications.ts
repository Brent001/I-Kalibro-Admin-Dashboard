import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import {
	tbl_book,
	tbl_book_borrowing,
	tbl_journal,
	tbl_journal_borrowing,
	tbl_library_settings,
	tbl_magazine,
	tbl_magazine_borrowing,
	tbl_notification,
	tbl_thesis,
	tbl_thesis_borrowing
} from '$lib/server/db/schema/schema.js';

type NotificationPreference = 'notifReservationReady' | 'notifReturnConfirmation';

interface UserNotification {
	recipientId: number;
	title: string;
	message: string;
	type: string;
	relatedItemType?: string;
	relatedItemId?: number;
}

interface ActiveBorrowing {
	borrowingId: number;
	userId: number;
	itemId: number;
	itemTitle: string;
	dueDate: Date;
	itemType: 'book' | 'magazine' | 'thesis' | 'journal';
}

async function getSystemSettings(): Promise<Record<string, unknown>> {
	const [row] = await db
		.select({ settingValue: tbl_library_settings.settingValue, dataType: tbl_library_settings.dataType })
		.from(tbl_library_settings)
		.where(eq(tbl_library_settings.settingKey, 'systemSettings'))
		.limit(1);

	if (!row || row.dataType !== 'json') return {};
	try {
		const settings: unknown = JSON.parse(row.settingValue);
		return settings && typeof settings === 'object' && !Array.isArray(settings)
			? (settings as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

export async function createConfiguredUserNotification(
	preference: NotificationPreference,
	notification: UserNotification
): Promise<boolean> {
	const settings = await getSystemSettings();
	if (settings[preference] === false) return false;

	try {
		await db.insert(tbl_notification).values({
			recipientId: notification.recipientId,
			recipientType: 'user',
			title: notification.title,
			message: notification.message,
			type: notification.type,
			relatedItemType: notification.relatedItemType ?? null,
			relatedItemId: notification.relatedItemId ?? null,
			sentAt: new Date()
		});
		return true;
	} catch (cause) {
		console.error('Failed to create user notification:', cause);
		return false;
	}
}

export async function createDueDateNotifications(now = new Date()): Promise<number> {
	const settings = await getSystemSettings();
	const dueReminderEnabled = settings.notifDueReminder !== false;
	const overdueEnabled = settings.notifOverdue !== false;
	if (!dueReminderEnabled && !overdueEnabled) return 0;

	const configuredReminderDays = Number(settings.notifDueReminderDaysBefore);
	const reminderDays = Number.isInteger(configuredReminderDays) && configuredReminderDays > 0
		? Math.min(configuredReminderDays, 14)
		: 2;
	const configuredOverdueDays = Number(settings.autoMarkOverdueDays);
	const overdueDays = Number.isInteger(configuredOverdueDays) && configuredOverdueDays >= 0
		? configuredOverdueDays
		: 1;
	const reminderCutoff = now.getTime() + reminderDays * 86_400_000;
	const overdueCutoff = now.getTime() - overdueDays * 86_400_000;

	const [books, magazines, theses, journals] = await Promise.all([
	db.select({
		borrowingId: tbl_book_borrowing.id,
		userId: tbl_book_borrowing.userId,
		itemId: tbl_book.id,
		itemTitle: tbl_book.title,
		dueDate: tbl_book_borrowing.dueDate
	}).from(tbl_book_borrowing)
		.innerJoin(tbl_book, eq(tbl_book_borrowing.bookId, tbl_book.id))
		.where(and(or(eq(tbl_book_borrowing.status, 'borrowed'), eq(tbl_book_borrowing.status, 'overdue')), isNull(tbl_book_borrowing.returnDate))),
	db.select({ borrowingId: tbl_magazine_borrowing.id, userId: tbl_magazine_borrowing.userId, itemId: tbl_magazine.id, itemTitle: tbl_magazine.title, dueDate: tbl_magazine_borrowing.dueDate })
		.from(tbl_magazine_borrowing)
		.innerJoin(tbl_magazine, eq(tbl_magazine_borrowing.magazineId, tbl_magazine.id))
		.where(and(or(eq(tbl_magazine_borrowing.status, 'borrowed'), eq(tbl_magazine_borrowing.status, 'overdue')), isNull(tbl_magazine_borrowing.returnDate))),
	db.select({ borrowingId: tbl_thesis_borrowing.id, userId: tbl_thesis_borrowing.userId, itemId: tbl_thesis.id, itemTitle: tbl_thesis.title, dueDate: tbl_thesis_borrowing.dueDate })
		.from(tbl_thesis_borrowing)
		.innerJoin(tbl_thesis, eq(tbl_thesis_borrowing.thesisId, tbl_thesis.id))
		.where(and(or(eq(tbl_thesis_borrowing.status, 'borrowed'), eq(tbl_thesis_borrowing.status, 'overdue')), isNull(tbl_thesis_borrowing.returnDate))),
	db.select({ borrowingId: tbl_journal_borrowing.id, userId: tbl_journal_borrowing.userId, itemId: tbl_journal.id, itemTitle: tbl_journal.title, dueDate: tbl_journal_borrowing.dueDate })
		.from(tbl_journal_borrowing)
		.innerJoin(tbl_journal, eq(tbl_journal_borrowing.journalId, tbl_journal.id))
		.where(and(or(eq(tbl_journal_borrowing.status, 'borrowed'), eq(tbl_journal_borrowing.status, 'overdue')), isNull(tbl_journal_borrowing.returnDate)))
	]);

	const borrowings: ActiveBorrowing[] = [
		...books.map((item) => ({ ...item, itemType: 'book' as const })),
		...magazines.map((item) => ({ ...item, itemType: 'magazine' as const })),
		...theses.map((item) => ({ ...item, itemType: 'thesis' as const })),
		...journals.map((item) => ({ ...item, itemType: 'journal' as const }))
	];

	const existing = await db
		.select({ recipientId: tbl_notification.recipientId, type: tbl_notification.type, message: tbl_notification.message })
		.from(tbl_notification)
		.where(and(
			eq(tbl_notification.recipientType, 'user'),
			inArray(tbl_notification.type, ['due_reminder', 'overdue'])
		));
	const existingKeys = new Set(existing.map((row) => `${row.recipientId}|${row.type}|${row.message}`));
	const pending = [];

	for (const borrowing of borrowings) {
		const dueTime = new Date(borrowing.dueDate).getTime();
		if (!Number.isFinite(dueTime)) continue;

		const dueDateLabel = new Date(borrowing.dueDate).toLocaleDateString('en-US', { timeZone: 'UTC' });
		const candidates = [];
		if (dueReminderEnabled && dueTime > now.getTime() && dueTime <= reminderCutoff) {
			candidates.push({
				type: 'due_reminder',
				title: 'Return due soon',
				message: `Please return your ${borrowing.itemType} "${borrowing.itemTitle}" by ${dueDateLabel} (borrowing #${borrowing.borrowingId}) to avoid overdue fines. No fine is implied by this reminder. Check Fine Status for any existing balance.`
			});
		}
		if (overdueEnabled && dueTime <= overdueCutoff) {
			candidates.push({
				type: 'overdue',
				title: 'Item overdue',
				message: `Your ${borrowing.itemType} "${borrowing.itemTitle}" was due on ${dueDateLabel} (borrowing #${borrowing.borrowingId}). Please return it as soon as possible, then check Fine Status for any recorded amount due.`
			});
		}

		for (const candidate of candidates) {
			const key = `${borrowing.userId}|${candidate.type}|${candidate.message}`;
			if (existingKeys.has(key)) continue;
			existingKeys.add(key);
			pending.push({
				recipientId: borrowing.userId,
				recipientType: 'user' as const,
				title: candidate.title,
				message: candidate.message,
				type: candidate.type,
				relatedItemType: borrowing.itemType,
				relatedItemId: borrowing.itemId,
				sentAt: now
			});
		}
	}

	if (pending.length > 0) await db.insert(tbl_notification).values(pending);
	return pending.length;
}