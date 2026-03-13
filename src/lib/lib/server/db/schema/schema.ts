import { pgTable, serial, integer, varchar, boolean, date, timestamp, text, jsonb, decimal } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================
// AUTHENTICATION & AUTHORIZATION TABLES
// ============================================

export const tbl_super_admin = pgTable('tbl_super_admin', {
    id: serial('id').primaryKey(),
    uniqueId: varchar('unique_id', { length: 36 }).unique().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).unique().notNull(),
    username: varchar('username', { length: 50 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    profilePhoto: varchar('profile_photo', { length: 255 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_user_session = pgTable('tbl_user_session', {
    id: serial('id').primaryKey(),
    sessionId: varchar('session_id', { length: 128 }).unique().notNull(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    tokenHash: varchar('token_hash', { length: 128 }),
    refreshTokenHash: varchar('refresh_token_hash', { length: 128 }),
    userAgent: varchar('user_agent', { length: 500 }),
    ipAddress: varchar('ip_address', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow(),
    lastUsedAt: timestamp('last_used_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
    isActive: boolean('is_active').default(true)
});

export const tbl_staff_session = pgTable('tbl_staff_session', {
    id: serial('id').primaryKey(),
    sessionId: varchar('session_id', { length: 128 }).unique().notNull(),
    actorType: varchar('actor_type', { length: 20 }).notNull(), // 'staff' | 'admin' | 'super_admin'
    actorId: integer('actor_id').notNull(), // stores the id from the corresponding actor table
    tokenHash: varchar('token_hash', { length: 128 }),
    refreshTokenHash: varchar('refresh_token_hash', { length: 128 }),
    userAgent: varchar('user_agent', { length: 500 }),
    ipAddress: varchar('ip_address', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow(),
    lastUsedAt: timestamp('last_used_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
    isActive: boolean('is_active').default(true)
});

export const tbl_admin = pgTable('tbl_admin', {
    id: serial('id').primaryKey(),
    uniqueId: varchar('unique_id', { length: 36 }).unique().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).unique().notNull(),
    username: varchar('username', { length: 50 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    profilePhoto: varchar('profile_photo', { length: 255 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_staff = pgTable('tbl_staff', {
    id: serial('id').primaryKey(),
    uniqueId: varchar('unique_id', { length: 36 }).unique().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).unique().notNull(),
    username: varchar('username', { length: 50 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    profilePhoto: varchar('profile_photo', { length: 255 }),
    department: varchar('department', { length: 100 }),
    position: varchar('position', { length: 100 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_staff_permission = pgTable('tbl_staff_permission', {
    id: serial('id').primaryKey(),
    staffUniqueId: varchar('staff_unique_id', { length: 36 }).references(() => tbl_staff.uniqueId).unique().notNull(),
    canManageBooks: boolean('can_manage_books').default(false),
    canManageUsers: boolean('can_manage_users').default(false),
    canManageBorrowing: boolean('can_manage_borrowing').default(true),
    canManageReservations: boolean('can_manage_reservations').default(true),
    canViewReports: boolean('can_view_reports').default(false),
    canManageFines: boolean('can_manage_fines').default(true),
    customPermissions: jsonb('custom_permissions').default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// ============================================
// USER TABLES
// ============================================

export const tbl_user = pgTable('tbl_user', {
    id: serial('id').primaryKey(),
    uniqueId: varchar('unique_id', { length: 36 }).unique().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).unique(),
    phone: varchar('phone', { length: 20 }),
    username: varchar('username', { length: 50 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    profilePhoto: varchar('profile_photo', { length: 255 }),
    userType: varchar('user_type', { length: 20 }).notNull(), // 'student' | 'faculty'
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_student = pgTable('tbl_student', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).unique().notNull(),
    enrollmentNo: varchar('enrollment_no', { length: 30 }).unique().notNull(),
    gender: varchar('gender', { length: 20 }),
    age: integer('age'),
    course: varchar('course', { length: 100 }),
    year: varchar('year', { length: 20 }),
    department: varchar('department', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_faculty = pgTable('tbl_faculty', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).unique().notNull(),
    facultyNumber: varchar('faculty_number', { length: 30 }).unique().notNull(),
    gender: varchar('gender', { length: 20 }),
    age: integer('age'),
    department: varchar('department', { length: 100 }),
    position: varchar('position', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// ============================================
// LIBRARY ITEM TABLES
// ============================================

export const tbl_category = pgTable('tbl_category', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).unique().notNull(),
    description: text('description'),
    itemType: varchar('item_type', { length: 30 }).notNull(), // 'book' | 'magazine' | 'thesis' | 'journal'
    createdAt: timestamp('created_at').defaultNow()
});

export const tbl_book = pgTable('tbl_book', {
    id: serial('id').primaryKey(),
    bookId: varchar('book_id', { length: 30 }).unique().notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    author: varchar('author', { length: 200 }),
    isbn: varchar('isbn', { length: 20 }).unique(),
    publisher: varchar('publisher', { length: 100 }),
    publishedYear: integer('published_year'),
    edition: varchar('edition', { length: 50 }),
    language: varchar('language', { length: 50 }),
    pages: integer('pages'),
    categoryId: integer('category_id').references(() => tbl_category.id),
    location: varchar('location', { length: 100 }),
    totalCopies: integer('total_copies').default(0),
    availableCopies: integer('available_copies').default(0),
    description: text('description'),
    coverImage: varchar('cover_image', { length: 255 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_book_copy = pgTable('tbl_book_copy', {
    id: serial('id').primaryKey(),
    bookId: integer('book_id').references(() => tbl_book.id).notNull(),
    copyNumber: integer('copy_number').notNull(),
    callNumber: varchar('call_number', { length: 100 }).unique().notNull(),
    qrCode: varchar('qr_code', { length: 255 }).unique().notNull(),
    status: varchar('status', { length: 20 }).default('available'), // 'available' | 'borrowed' | 'reserved'
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_magazine = pgTable('tbl_magazine', {
    id: serial('id').primaryKey(),
    magazineId: varchar('magazine_id', { length: 30 }).unique().notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    publisher: varchar('publisher', { length: 100 }),
    issn: varchar('issn', { length: 20 }),
    issueNumber: varchar('issue_number', { length: 50 }),
    volume: varchar('volume', { length: 50 }),
    publishedDate: date('published_date'),
    language: varchar('language', { length: 50 }),
    categoryId: integer('category_id').references(() => tbl_category.id),
    location: varchar('location', { length: 100 }),
    totalCopies: integer('total_copies').default(0),
    availableCopies: integer('available_copies').default(0),
    description: text('description'),
    coverImage: varchar('cover_image', { length: 255 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_magazine_copy = pgTable('tbl_magazine_copy', {
    id: serial('id').primaryKey(),
    magazineId: integer('magazine_id').references(() => tbl_magazine.id).notNull(),
    copyNumber: integer('copy_number').notNull(),
    callNumber: varchar('call_number', { length: 100 }).unique().notNull(),
    qrCode: varchar('qr_code', { length: 255 }).unique().notNull(),
    status: varchar('status', { length: 20 }).default('available'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_thesis = pgTable('tbl_thesis', {
    id: serial('id').primaryKey(),
    thesisId: varchar('thesis_id', { length: 30 }).unique().notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    author: varchar('author', { length: 200 }).notNull(),
    advisor: varchar('advisor', { length: 200 }),
    department: varchar('department', { length: 100 }),
    publicationYear: integer('publication_year'),
    abstract: text('abstract'),
    categoryId: integer('category_id').references(() => tbl_category.id),
    location: varchar('location', { length: 100 }),
    totalCopies: integer('total_copies').default(0),
    availableCopies: integer('available_copies').default(0),
    pdfFile: varchar('pdf_file', { length: 255 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_thesis_copy = pgTable('tbl_thesis_copy', {
    id: serial('id').primaryKey(),
    thesisId: integer('thesis_id').references(() => tbl_thesis.id).notNull(),
    copyNumber: integer('copy_number').notNull(),
    callNumber: varchar('call_number', { length: 100 }).unique().notNull(),
    qrCode: varchar('qr_code', { length: 255 }).unique().notNull(),
    status: varchar('status', { length: 20 }).default('available'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_journal = pgTable('tbl_journal', {
    id: serial('id').primaryKey(),
    journalId: varchar('journal_id', { length: 30 }).unique().notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    publisher: varchar('publisher', { length: 100 }),
    issn: varchar('issn', { length: 20 }),
    volume: varchar('volume', { length: 50 }),
    issueNumber: varchar('issue_number', { length: 50 }),
    publishedDate: date('published_date'),
    language: varchar('language', { length: 50 }),
    categoryId: integer('category_id').references(() => tbl_category.id),
    location: varchar('location', { length: 100 }),
    totalCopies: integer('total_copies').default(0),
    availableCopies: integer('available_copies').default(0),
    description: text('description'),
    coverImage: varchar('cover_image', { length: 255 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_journal_copy = pgTable('tbl_journal_copy', {
    id: serial('id').primaryKey(),
    journalId: integer('journal_id').references(() => tbl_journal.id).notNull(),
    copyNumber: integer('copy_number').notNull(),
    callNumber: varchar('call_number', { length: 100 }).unique().notNull(),
    qrCode: varchar('qr_code', { length: 255 }).unique().notNull(),
    status: varchar('status', { length: 20 }).default('available'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// ============================================
// RESERVATION TABLES
// Covers both "hold a currently-available item" and
// "request to borrow" — staff approval converts it
// to an active borrowing record.
// ============================================

export const tbl_book_reservation = pgTable('tbl_book_reservation', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    bookId: integer('book_id').references(() => tbl_book.id).notNull(),
    bookCopyId: integer('book_copy_id').references(() => tbl_book_copy.id), // assigned on approval
    requestDate: timestamp('request_date').notNull(),
    requestedBorrowDate: timestamp('requested_borrow_date').notNull(),
    requestedDueDate: timestamp('requested_due_date').notNull(),
    expiryDate: timestamp('expiry_date').notNull(),
    status: varchar('status', { length: 20 }).default('pending'), // 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'expired' | 'cancelled'
    reviewedBy: integer('reviewed_by').references(() => tbl_staff.id),
    reviewDate: timestamp('review_date'),
    remarks: text('remarks'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_magazine_reservation = pgTable('tbl_magazine_reservation', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    magazineId: integer('magazine_id').references(() => tbl_magazine.id).notNull(),
    magazineCopyId: integer('magazine_copy_id').references(() => tbl_magazine_copy.id),
    requestDate: timestamp('request_date').notNull(),
    requestedBorrowDate: timestamp('requested_borrow_date').notNull(),
    requestedDueDate: timestamp('requested_due_date').notNull(),
    expiryDate: timestamp('expiry_date').notNull(),
    status: varchar('status', { length: 20 }).default('pending'),
    reviewedBy: integer('reviewed_by').references(() => tbl_staff.id),
    reviewDate: timestamp('review_date'),
    remarks: text('remarks'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_thesis_reservation = pgTable('tbl_thesis_reservation', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    thesisId: integer('thesis_id').references(() => tbl_thesis.id).notNull(),
    thesisCopyId: integer('thesis_copy_id').references(() => tbl_thesis_copy.id),
    requestDate: timestamp('request_date').notNull(),
    requestedBorrowDate: timestamp('requested_borrow_date').notNull(),
    requestedDueDate: timestamp('requested_due_date').notNull(),
    expiryDate: timestamp('expiry_date').notNull(),
    status: varchar('status', { length: 20 }).default('pending'),
    reviewedBy: integer('reviewed_by').references(() => tbl_staff.id),
    reviewDate: timestamp('review_date'),
    remarks: text('remarks'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_journal_reservation = pgTable('tbl_journal_reservation', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    journalId: integer('journal_id').references(() => tbl_journal.id).notNull(),
    journalCopyId: integer('journal_copy_id').references(() => tbl_journal_copy.id),
    requestDate: timestamp('request_date').notNull(),
    requestedBorrowDate: timestamp('requested_borrow_date').notNull(),
    requestedDueDate: timestamp('requested_due_date').notNull(),
    expiryDate: timestamp('expiry_date').notNull(),
    status: varchar('status', { length: 20 }).default('pending'),
    reviewedBy: integer('reviewed_by').references(() => tbl_staff.id),
    reviewDate: timestamp('review_date'),
    remarks: text('remarks'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// ============================================
// BORROWING TABLES
// Created by staff when approving a reservation.
// reservationId links back to where it originated.
// ============================================

export const tbl_book_borrowing = pgTable('tbl_book_borrowing', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    bookId: integer('book_id').references(() => tbl_book.id).notNull(),
    bookCopyId: integer('book_copy_id').references(() => tbl_book_copy.id).notNull(),
    reservationId: integer('reservation_id').references(() => tbl_book_reservation.id),
    borrowDate: timestamp('borrow_date').notNull(),
    dueDate: timestamp('due_date').notNull(),
    returnDate: timestamp('return_date'),
    status: varchar('status', { length: 20 }).default('borrowed'), // 'borrowed' | 'returned' | 'overdue'
    approvedBy: integer('approved_by').references(() => tbl_staff.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_magazine_borrowing = pgTable('tbl_magazine_borrowing', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    magazineId: integer('magazine_id').references(() => tbl_magazine.id).notNull(),
    magazineCopyId: integer('magazine_copy_id').references(() => tbl_magazine_copy.id).notNull(),
    reservationId: integer('reservation_id').references(() => tbl_magazine_reservation.id),
    borrowDate: timestamp('borrow_date').notNull(),
    dueDate: timestamp('due_date').notNull(),
    returnDate: timestamp('return_date'),
    status: varchar('status', { length: 20 }).default('borrowed'),
    approvedBy: integer('approved_by').references(() => tbl_staff.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_thesis_borrowing = pgTable('tbl_thesis_borrowing', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    thesisId: integer('thesis_id').references(() => tbl_thesis.id).notNull(),
    thesisCopyId: integer('thesis_copy_id').references(() => tbl_thesis_copy.id).notNull(),
    reservationId: integer('reservation_id').references(() => tbl_thesis_reservation.id),
    borrowDate: timestamp('borrow_date').notNull(),
    dueDate: timestamp('due_date').notNull(),
    returnDate: timestamp('return_date'),
    status: varchar('status', { length: 20 }).default('borrowed'),
    approvedBy: integer('approved_by').references(() => tbl_staff.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_journal_borrowing = pgTable('tbl_journal_borrowing', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    journalId: integer('journal_id').references(() => tbl_journal.id).notNull(),
    journalCopyId: integer('journal_copy_id').references(() => tbl_journal_copy.id).notNull(),
    reservationId: integer('reservation_id').references(() => tbl_journal_reservation.id),
    borrowDate: timestamp('borrow_date').notNull(),
    dueDate: timestamp('due_date').notNull(),
    returnDate: timestamp('return_date'),
    status: varchar('status', { length: 20 }).default('borrowed'),
    approvedBy: integer('approved_by').references(() => tbl_staff.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// ============================================
// RETURN REQUEST TABLES
// ============================================

export const tbl_book_return_request = pgTable('tbl_book_return_request', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    borrowingId: integer('borrowing_id').references(() => tbl_book_borrowing.id).notNull(),
    bookCopyId: integer('book_copy_id').references(() => tbl_book_copy.id).notNull(),
    requestDate: timestamp('request_date').notNull(),
    requestedReturnDate: timestamp('requested_return_date').notNull(),
    status: varchar('status', { length: 20 }).default('pending'), // 'pending' | 'approved' | 'rejected' | 'cancelled'
    condition: varchar('condition', { length: 20 }), // 'good' | 'damaged' | 'lost'
    userRemarks: text('user_remarks'),
    reviewedBy: integer('reviewed_by').references(() => tbl_staff.id),
    reviewDate: timestamp('review_date'),
    staffRemarks: text('staff_remarks'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_magazine_return_request = pgTable('tbl_magazine_return_request', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    borrowingId: integer('borrowing_id').references(() => tbl_magazine_borrowing.id).notNull(),
    magazineCopyId: integer('magazine_copy_id').references(() => tbl_magazine_copy.id).notNull(),
    requestDate: timestamp('request_date').notNull(),
    requestedReturnDate: timestamp('requested_return_date').notNull(),
    status: varchar('status', { length: 20 }).default('pending'),
    condition: varchar('condition', { length: 20 }),
    userRemarks: text('user_remarks'),
    reviewedBy: integer('reviewed_by').references(() => tbl_staff.id),
    reviewDate: timestamp('review_date'),
    staffRemarks: text('staff_remarks'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_thesis_return_request = pgTable('tbl_thesis_return_request', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    borrowingId: integer('borrowing_id').references(() => tbl_thesis_borrowing.id).notNull(),
    thesisCopyId: integer('thesis_copy_id').references(() => tbl_thesis_copy.id).notNull(),
    requestDate: timestamp('request_date').notNull(),
    requestedReturnDate: timestamp('requested_return_date').notNull(),
    status: varchar('status', { length: 20 }).default('pending'),
    condition: varchar('condition', { length: 20 }),
    userRemarks: text('user_remarks'),
    reviewedBy: integer('reviewed_by').references(() => tbl_staff.id),
    reviewDate: timestamp('review_date'),
    staffRemarks: text('staff_remarks'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const tbl_journal_return_request = pgTable('tbl_journal_return_request', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    borrowingId: integer('borrowing_id').references(() => tbl_journal_borrowing.id).notNull(),
    journalCopyId: integer('journal_copy_id').references(() => tbl_journal_copy.id).notNull(),
    requestDate: timestamp('request_date').notNull(),
    requestedReturnDate: date('requested_return_date').notNull(),
    status: varchar('status', { length: 20 }).default('pending'),
    condition: varchar('condition', { length: 20 }),
    userRemarks: text('user_remarks'),
    reviewedBy: integer('reviewed_by').references(() => tbl_staff.id),
    reviewDate: timestamp('review_date'),
    staffRemarks: text('staff_remarks'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// ============================================
// TRANSACTION & FINE TABLES
// ============================================

export const tbl_fine = pgTable('tbl_fine', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    itemType: varchar('item_type', { length: 30 }).notNull(), // 'book' | 'magazine' | 'thesis' | 'journal'
    borrowingId: integer('borrowing_id').notNull(),
    fineAmount: decimal('fine_amount', { precision: 10, scale: 2 }).notNull(),
    daysOverdue: integer('days_overdue').notNull(),
    status: varchar('status', { length: 20 }).default('unpaid'), // 'unpaid' | 'paid' | 'waived'
    calculatedAt: timestamp('calculated_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow()
});

export const tbl_payment = pgTable('tbl_payment', {
    id: serial('id').primaryKey(),
    transactionId: varchar('transaction_id', { length: 50 }).unique().notNull(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    paymentType: varchar('payment_type', { length: 30 }).notNull(), // 'fine' | 'membership' | 'damage'
    paymentMethod: varchar('payment_method', { length: 30 }).default('cash'),
    relatedFineId: integer('related_fine_id').references(() => tbl_fine.id),
    receivedBy: integer('received_by').references(() => tbl_staff.id),
    remarks: text('remarks'),
    paymentDate: timestamp('payment_date').defaultNow(),
    createdAt: timestamp('created_at').defaultNow()
});

export const tbl_return = pgTable('tbl_return', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    itemType: varchar('item_type', { length: 30 }).notNull(), // 'book' | 'magazine' | 'thesis' | 'journal'
    borrowingId: integer('borrowing_id').notNull(),
    copyId: integer('copy_id').notNull(),
    qrCodeScanned: varchar('qr_code_scanned', { length: 255 }),
    returnDate: timestamp('return_date').notNull(),
    remarks: text('remarks'),
    processedBy: integer('processed_by').references(() => tbl_staff.id),
    createdAt: timestamp('created_at').defaultNow()
});

// ============================================
// NOTIFICATION TABLES
// ============================================

export const tbl_notification = pgTable('tbl_notification', {
    id: serial('id').primaryKey(),
    recipientId: integer('recipient_id').notNull(),
    recipientType: varchar('recipient_type', { length: 20 }).notNull(), // 'user' | 'staff' | 'admin'
    title: varchar('title', { length: 200 }).notNull(),
    message: text('message').notNull(),
    type: varchar('type', { length: 30 }).notNull(), // 'due_reminder' | 'overdue' | 'reservation_ready' | 'return_confirmation'
    relatedItemType: varchar('related_item_type', { length: 30 }),
    relatedItemId: integer('related_item_id'),
    isRead: boolean('is_read').default(false),
    sentAt: timestamp('sent_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow()
});

// ============================================
// ACTIVITY & LOGGING TABLES
// ============================================

export const tbl_library_visit = pgTable('tbl_library_visit', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id),
    visitorName: varchar('visitor_name', { length: 100 }),
    visitorType: varchar('visitor_type', { length: 20 }),
    purpose: text('purpose'),
    timeIn: timestamp('time_in').notNull(),
    timeOut: timestamp('time_out'),
    createdAt: timestamp('created_at').defaultNow()
});

export const tbl_user_activity = pgTable('tbl_user_activity', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    activityType: varchar('activity_type', { length: 50 }).notNull(),
    itemType: varchar('item_type', { length: 30 }),
    itemId: integer('item_id'),
    details: text('details'),
    timestamp: timestamp('timestamp').defaultNow()
});

export const tbl_security_log = pgTable('tbl_security_log', {
    id: serial('id').primaryKey(),
    userType: varchar('user_type', { length: 20 }).notNull(),
    userId: integer('user_id').notNull(),
    eventType: varchar('event_type', { length: 30 }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 255 }),
    timestamp: timestamp('timestamp').defaultNow()
});

// ============================================
// SYSTEM TABLES
// ============================================

export const tbl_qr_scan_log = pgTable('tbl_qr_scan_log', {
    id: serial('id').primaryKey(),
    qrCode: varchar('qr_code', { length: 255 }).notNull(),
    itemType: varchar('item_type', { length: 30 }),
    copyId: integer('copy_id'),
    scanType: varchar('scan_type', { length: 30 }).notNull(), // 'checkout' | 'return' | 'inventory' | 'verification'
    scannedBy: integer('scanned_by').references(() => tbl_staff.id),
    userId: integer('user_id').references(() => tbl_user.id),
    scanResult: varchar('scan_result', { length: 30 }).default('success'),
    scanLocation: varchar('scan_location', { length: 100 }),
    scannedAt: timestamp('scanned_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow()
});

export const tbl_library_settings = pgTable('tbl_library_settings', {
    id: serial('id').primaryKey(),
    settingKey: varchar('setting_key', { length: 100 }).unique().notNull(),
    settingValue: text('setting_value').notNull(),
    dataType: varchar('data_type', { length: 20 }).default('string'),
    description: text('description'),
    updatedBy: integer('updated_by'),
    updatedAt: timestamp('updated_at').defaultNow()
});