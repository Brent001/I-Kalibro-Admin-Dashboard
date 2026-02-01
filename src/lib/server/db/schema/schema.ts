import { pgTable, serial, integer, varchar, boolean, date, timestamp, text, jsonb, decimal } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================
// AUTHENTICATION & AUTHORIZATION TABLES
// ============================================

// Super Admin Table (System-level administrators)
export const tbl_super_admin = pgTable('tbl_super_admin', {
    id: serial('id').primaryKey(),
    uniqueId: varchar('unique_id', { length: 36 }).unique().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).unique().notNull(),
    username: varchar('username', { length: 50 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Admin Table (Library administrators)
export const tbl_admin = pgTable('tbl_admin', {
    id: serial('id').primaryKey(),
    uniqueId: varchar('unique_id', { length: 36 }).unique().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).unique().notNull(),
    username: varchar('username', { length: 50 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Staff Table (Library staff)
export const tbl_staff = pgTable('tbl_staff', {
    id: serial('id').primaryKey(),
    uniqueId: varchar('unique_id', { length: 36 }).unique().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).unique().notNull(),
    username: varchar('username', { length: 50 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    department: varchar('department', { length: 100 }),
    position: varchar('position', { length: 100 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Staff Permissions Table
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

// Base User Table
export const tbl_user = pgTable('tbl_user', {
    id: serial('id').primaryKey(),
    uniqueId: varchar('unique_id', { length: 36 }).unique().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).unique(),
    phone: varchar('phone', { length: 20 }),
    username: varchar('username', { length: 50 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    userType: varchar('user_type', { length: 20 }).notNull(), // 'student' or 'faculty'
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Student Profile Table
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

// Faculty Profile Table
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

// Category Table (For all library items)
export const tbl_category = pgTable('tbl_category', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).unique().notNull(),
    description: text('description'),
    itemType: varchar('item_type', { length: 30 }).notNull(), // 'book', 'magazine', 'research', 'multimedia'
    createdAt: timestamp('created_at').defaultNow()
});

// Book Table (Master record - one per title)
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
    location: varchar('location', { length: 100 }), // Shelf location
    totalCopies: integer('total_copies').default(0),
    availableCopies: integer('available_copies').default(0),
    description: text('description'),
    coverImage: varchar('cover_image', { length: 255 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Book Copy Table (Individual physical copies with QR codes)
export const tbl_book_copy = pgTable('tbl_book_copy', {
    id: serial('id').primaryKey(),
    bookId: integer('book_id').references(() => tbl_book.id).notNull(),
    copyNumber: varchar('copy_number', { length: 50 }).notNull(), // e.g., "Copy 1", "Copy 2"
    qrCode: varchar('qr_code', { length: 255 }).unique().notNull(),
    barcode: varchar('barcode', { length: 100 }).unique(),
    condition: varchar('condition', { length: 30 }).default('good'), // 'excellent', 'good', 'fair', 'poor', 'damaged'
    status: varchar('status', { length: 20 }).default('available'), // 'available', 'borrowed', 'reserved', 'maintenance', 'lost'
    acquisitionDate: date('acquisition_date'),
    lastMaintenanceDate: date('last_maintenance_date'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Magazine Table (Master record)
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

// Magazine Copy Table (Individual copies with QR codes)
export const tbl_magazine_copy = pgTable('tbl_magazine_copy', {
    id: serial('id').primaryKey(),
    magazineId: integer('magazine_id').references(() => tbl_magazine.id).notNull(),
    copyNumber: varchar('copy_number', { length: 50 }).notNull(),
    qrCode: varchar('qr_code', { length: 255 }).unique().notNull(),
    barcode: varchar('barcode', { length: 100 }).unique(),
    condition: varchar('condition', { length: 30 }).default('good'),
    status: varchar('status', { length: 20 }).default('available'),
    acquisitionDate: date('acquisition_date'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Research Document Table (Master record)
export const tbl_research_document = pgTable('tbl_research_document', {
    id: serial('id').primaryKey(),
    researchId: varchar('research_id', { length: 30 }).unique().notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    author: varchar('author', { length: 200 }).notNull(),
    advisor: varchar('advisor', { length: 200 }),
    department: varchar('department', { length: 100 }),
    degreeProgram: varchar('degree_program', { length: 100 }),
    publicationYear: integer('publication_year'),
    abstract: text('abstract'),
    keywords: text('keywords'),
    categoryId: integer('category_id').references(() => tbl_category.id),
    location: varchar('location', { length: 100 }),
    totalCopies: integer('total_copies').default(0),
    availableCopies: integer('available_copies').default(0),
    pdfFile: varchar('pdf_file', { length: 255 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Research Document Copy Table (Individual copies with QR codes)
export const tbl_research_copy = pgTable('tbl_research_copy', {
    id: serial('id').primaryKey(),
    researchId: integer('research_id').references(() => tbl_research_document.id).notNull(),
    copyNumber: varchar('copy_number', { length: 50 }).notNull(),
    qrCode: varchar('qr_code', { length: 255 }).unique().notNull(),
    barcode: varchar('barcode', { length: 100 }).unique(),
    condition: varchar('condition', { length: 30 }).default('good'),
    status: varchar('status', { length: 20 }).default('available'),
    acquisitionDate: date('acquisition_date'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Multimedia Item Table (Master record - CDs, DVDs, etc.)
export const tbl_multimedia = pgTable('tbl_multimedia', {
    id: serial('id').primaryKey(),
    multimediaId: varchar('multimedia_id', { length: 30 }).unique().notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // 'CD', 'DVD', 'Audio', 'Video'
    creator: varchar('creator', { length: 200 }),
    publisher: varchar('publisher', { length: 100 }),
    releaseYear: integer('release_year'),
    duration: varchar('duration', { length: 50 }),
    categoryId: integer('category_id').references(() => tbl_category.id),
    location: varchar('location', { length: 100 }),
    totalCopies: integer('total_copies').default(0),
    availableCopies: integer('available_copies').default(0),
    description: text('description'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Multimedia Copy Table (Individual copies with QR codes)
export const tbl_multimedia_copy = pgTable('tbl_multimedia_copy', {
    id: serial('id').primaryKey(),
    multimediaId: integer('multimedia_id').references(() => tbl_multimedia.id).notNull(),
    copyNumber: varchar('copy_number', { length: 50 }).notNull(),
    qrCode: varchar('qr_code', { length: 255 }).unique().notNull(),
    barcode: varchar('barcode', { length: 100 }).unique(),
    condition: varchar('condition', { length: 30 }).default('good'),
    status: varchar('status', { length: 20 }).default('available'),
    acquisitionDate: date('acquisition_date'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// ============================================
// BORROWING & RESERVATION TABLES
// ============================================

// Book Borrowing Table
export const tbl_book_borrowing = pgTable('tbl_book_borrowing', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    bookId: integer('book_id').references(() => tbl_book.id).notNull(),
    bookCopyId: integer('book_copy_id').references(() => tbl_book_copy.id).notNull(), // Specific copy borrowed
    borrowDate: date('borrow_date').notNull(),
    dueDate: date('due_date').notNull(),
    returnDate: date('return_date'),
    status: varchar('status', { length: 20 }).default('borrowed'), // 'borrowed', 'returned', 'overdue'
    approvedBy: integer('approved_by').references(() => tbl_staff.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Magazine Borrowing Table
export const tbl_magazine_borrowing = pgTable('tbl_magazine_borrowing', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    magazineId: integer('magazine_id').references(() => tbl_magazine.id).notNull(),
    magazineCopyId: integer('magazine_copy_id').references(() => tbl_magazine_copy.id).notNull(),
    borrowDate: date('borrow_date').notNull(),
    dueDate: date('due_date').notNull(),
    returnDate: date('return_date'),
    status: varchar('status', { length: 20 }).default('borrowed'),
    approvedBy: integer('approved_by').references(() => tbl_staff.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Research Document Borrowing Table
export const tbl_research_borrowing = pgTable('tbl_research_borrowing', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    researchId: integer('research_id').references(() => tbl_research_document.id).notNull(),
    researchCopyId: integer('research_copy_id').references(() => tbl_research_copy.id).notNull(),
    borrowDate: date('borrow_date').notNull(),
    dueDate: date('due_date').notNull(),
    returnDate: date('return_date'),
    status: varchar('status', { length: 20 }).default('borrowed'),
    approvedBy: integer('approved_by').references(() => tbl_staff.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Multimedia Borrowing Table
export const tbl_multimedia_borrowing = pgTable('tbl_multimedia_borrowing', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    multimediaId: integer('multimedia_id').references(() => tbl_multimedia.id).notNull(),
    multimediaCopyId: integer('multimedia_copy_id').references(() => tbl_multimedia_copy.id).notNull(),
    borrowDate: date('borrow_date').notNull(),
    dueDate: date('due_date').notNull(),
    returnDate: date('return_date'),
    status: varchar('status', { length: 20 }).default('borrowed'),
    approvedBy: integer('approved_by').references(() => tbl_staff.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Reservation Tables
export const tbl_book_reservation = pgTable('tbl_book_reservation', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    bookId: integer('book_id').references(() => tbl_book.id).notNull(),
    reservationDate: date('reservation_date').notNull(),
    expiryDate: date('expiry_date').notNull(),
    status: varchar('status', { length: 20 }).default('active'), // 'active', 'fulfilled', 'expired', 'cancelled'
    createdAt: timestamp('created_at').defaultNow()
});

export const tbl_magazine_reservation = pgTable('tbl_magazine_reservation', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    magazineId: integer('magazine_id').references(() => tbl_magazine.id).notNull(),
    reservationDate: date('reservation_date').notNull(),
    expiryDate: date('expiry_date').notNull(),
    status: varchar('status', { length: 20 }).default('active'),
    createdAt: timestamp('created_at').defaultNow()
});

// ============================================
// TRANSACTION & FINE TABLES
// ============================================

// Fine Transaction Table (Unified for all item types)
export const tbl_fine = pgTable('tbl_fine', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    itemType: varchar('item_type', { length: 30 }).notNull(), // 'book', 'magazine', 'research', 'multimedia'
    borrowingId: integer('borrowing_id').notNull(), // References specific borrowing table
    fineAmount: decimal('fine_amount', { precision: 10, scale: 2 }).notNull(), // In pesos
    daysOverdue: integer('days_overdue').notNull(),
    status: varchar('status', { length: 20 }).default('unpaid'), // 'unpaid', 'paid', 'waived'
    calculatedAt: timestamp('calculated_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow()
});

// Payment Transaction Table
export const tbl_payment = pgTable('tbl_payment', {
    id: serial('id').primaryKey(),
    transactionId: varchar('transaction_id', { length: 50 }).unique().notNull(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    paymentType: varchar('payment_type', { length: 30 }).notNull(), // 'fine', 'membership', 'damage'
    paymentMethod: varchar('payment_method', { length: 30 }).default('cash'), // 'cash', 'card', 'online'
    relatedFineId: integer('related_fine_id').references(() => tbl_fine.id),
    receivedBy: integer('received_by').references(() => tbl_staff.id),
    remarks: text('remarks'),
    paymentDate: timestamp('payment_date').defaultNow(),
    createdAt: timestamp('created_at').defaultNow()
});

// Return Transaction Table (Unified)
export const tbl_return = pgTable('tbl_return', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    itemType: varchar('item_type', { length: 30 }).notNull(),
    borrowingId: integer('borrowing_id').notNull(),
    copyId: integer('copy_id').notNull(), // References the specific copy table
    qrCodeScanned: varchar('qr_code_scanned', { length: 255 }), // QR code used for return
    returnDate: timestamp('return_date').notNull(),
    condition: varchar('condition', { length: 30 }).default('good'), // 'good', 'damaged', 'lost'
    conditionNotes: text('condition_notes'), // Details about damage if any
    remarks: text('remarks'),
    processedBy: integer('processed_by').references(() => tbl_staff.id),
    createdAt: timestamp('created_at').defaultNow()
});

// ============================================
// NOTIFICATION TABLES
// ============================================

// Notification Table
export const tbl_notification = pgTable('tbl_notification', {
    id: serial('id').primaryKey(),
    recipientId: integer('recipient_id').notNull(), // User ID
    recipientType: varchar('recipient_type', { length: 20 }).notNull(), // 'user', 'staff', 'admin'
    title: varchar('title', { length: 200 }).notNull(),
    message: text('message').notNull(),
    type: varchar('type', { length: 30 }).notNull(), // 'due_reminder', 'overdue', 'reservation_ready', 'return_confirmation'
    relatedItemType: varchar('related_item_type', { length: 30 }),
    relatedItemId: integer('related_item_id'),
    isRead: boolean('is_read').default(false),
    sentAt: timestamp('sent_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow()
});

// ============================================
// ACTIVITY & LOGGING TABLES
// ============================================

// Library Visit Log
export const tbl_library_visit = pgTable('tbl_library_visit', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id),
    visitorName: varchar('visitor_name', { length: 100 }),
    visitorType: varchar('visitor_type', { length: 20 }), // 'student', 'faculty', 'guest'
    purpose: text('purpose'),
    timeIn: timestamp('time_in').notNull(),
    timeOut: timestamp('time_out'),
    createdAt: timestamp('created_at').defaultNow()
});

// User Activity Log
export const tbl_user_activity = pgTable('tbl_user_activity', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => tbl_user.id).notNull(),
    activityType: varchar('activity_type', { length: 50 }).notNull(), // 'borrow', 'return', 'reserve', 'search'
    itemType: varchar('item_type', { length: 30 }),
    itemId: integer('item_id'),
    details: text('details'),
    timestamp: timestamp('timestamp').defaultNow()
});

// Security Log (Login/Logout tracking)
export const tbl_security_log = pgTable('tbl_security_log', {
    id: serial('id').primaryKey(),
    userType: varchar('user_type', { length: 20 }).notNull(), // 'super_admin', 'admin', 'staff', 'user'
    userId: integer('user_id').notNull(),
    eventType: varchar('event_type', { length: 30 }).notNull(), // 'login', 'logout', 'failed_login'
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 255 }),
    timestamp: timestamp('timestamp').defaultNow()
});

// ============================================
// SYSTEM TABLES
// ============================================

// QR Code Scan Log (Track all QR code scans)
export const tbl_qr_scan_log = pgTable('tbl_qr_scan_log', {
    id: serial('id').primaryKey(),
    qrCode: varchar('qr_code', { length: 255 }).notNull(),
    itemType: varchar('item_type', { length: 30 }), // 'book', 'magazine', 'research', 'multimedia'
    copyId: integer('copy_id'), // ID of the copy scanned
    scanType: varchar('scan_type', { length: 30 }).notNull(), // 'checkout', 'return', 'inventory', 'verification'
    scannedBy: integer('scanned_by').references(() => tbl_staff.id),
    userId: integer('user_id').references(() => tbl_user.id), // User checking out/returning
    scanResult: varchar('scan_result', { length: 30 }).default('success'), // 'success', 'invalid', 'already_borrowed', 'not_found'
    scanLocation: varchar('scan_location', { length: 100 }), // 'front_desk', 'return_station', etc.
    scannedAt: timestamp('scanned_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow()
});

// QR Code Token Table (for temporary tokens/access)
export const tbl_qr_token = pgTable('tbl_qr_token', {
    id: serial('id').primaryKey(),
    token: varchar('token', { length: 255 }).unique().notNull(),
    tokenType: varchar('token_type', { length: 30 }).notNull(), // 'entry', 'checkout', 'verification'
    expiresAt: timestamp('expires_at'),
    isUsed: boolean('is_used').default(false),
    createdAt: timestamp('created_at').defaultNow()
});

// Library Settings Table
export const tbl_library_settings = pgTable('tbl_library_settings', {
    id: serial('id').primaryKey(),
    settingKey: varchar('setting_key', { length: 100 }).unique().notNull(),
    settingValue: text('setting_value').notNull(),
    dataType: varchar('data_type', { length: 20 }).default('string'), // 'string', 'number', 'boolean', 'json'
    description: text('description'),
    updatedBy: integer('updated_by'),
    updatedAt: timestamp('updated_at').defaultNow()
});