import { pgTable, serial, integer, varchar, boolean, date, timestamp } from 'drizzle-orm/pg-core';

// Account table for admin and staff only
export const account = pgTable('account', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }),
    email: varchar('email', { length: 100 }).unique(),
    username: varchar('username', { length: 50 }).unique(),
    password: varchar('password', { length: 255 }), // hashed password
    role: varchar('role', { length: 20 }), // 'admin' or 'staff'
    isActive: boolean('is_active').default(true),
    tokenVersion: integer('token_version').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Unified user table for students and faculty
export const user = pgTable('user', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).unique(),
    phone: varchar('phone', { length: 20 }),
    username: varchar('username', { length: 50 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(), // hashed password
    passwordSalt: varchar('password_salt', { length: 255 }),
    role: varchar('role', { length: 20 }).notNull(), // 'student' or 'faculty'
    age: integer('age'),
    
    // Student-specific fields (null for faculty)
    enrollmentNo: varchar('enrollment_no', { length: 30 }).unique(),
    course: varchar('course', { length: 50 }),
    year: varchar('year', { length: 20 }), // student year/semester
    
    // Faculty-specific fields (null for students)
    department: varchar('department', { length: 100 }),
    designation: varchar('designation', { length: 50 }),
    
    // Common fields
    lastPasswordChange: timestamp('last_password_change').defaultNow(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Book table with QR code and category
export const book = pgTable('book', {
    id: serial('id').primaryKey(),
    bookId: varchar('book_id', { length: 30 }).unique().notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    author: varchar('author', { length: 100 }),
    language: varchar('language', { length: 50 }), // <-- Added language field
    qrCode: varchar('qr_code', { length: 255 }).unique(),
    publishedYear: integer('published_year'),
    copiesAvailable: integer('copies_available').default(0),
    categoryId: integer('category_id').references(() => category.id),
    publisher: varchar('publisher', { length: 100 }),
    edition: varchar('edition', { length: 50 }),
    location: varchar('location', { length: 100 }),
    description: varchar('description', { length: 500 }),
    tags: varchar('tags', { length: 255 }),
    supplier: varchar('supplier', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Category table for books
export const category = pgTable('category', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 50 }).unique().notNull(),
    description: varchar('description', { length: 255 }).default(''),
    createdAt: timestamp('created_at').defaultNow()
});

// Book transactions table (comprehensive transaction tracking)
export const bookTransaction = pgTable('book_transaction', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).notNull(),
    bookId: integer('book_id').references(() => book.id).notNull(),
    transactionType: varchar('transaction_type', { length: 20 }).notNull(), // 'borrow', 'return', 'reserve', 'renew'
    issueDate: date('issue_date'),
    dueDate: date('due_date'),
    returnDate: date('return_date'), // Expected return date
    actualReturnDate: date('actual_return_date'), // Actual return date
    renewalCount: integer('renewal_count').default(0), // Track how many times renewed
    maxRenewals: integer('max_renewals').default(2), // Maximum allowed renewals
    status: varchar('status', { length: 20 }).default('active'), // 'active', 'returned', 'overdue', 'lost', 'damaged'
    issuedBy: integer('issued_by').references(() => account.id), // Staff who issued the book
    returnedTo: integer('returned_to').references(() => account.id), // Staff who received the return
    notes: varchar('notes', { length: 500 }), // Additional notes
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Book reservations table
export const bookReservation = pgTable('book_reservation', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).notNull(),
    bookId: integer('book_id').references(() => book.id).notNull(),
    reservationDate: timestamp('reservation_date').defaultNow(),
    expiryDate: timestamp('expiry_date'), // When reservation expires
    notifiedDate: timestamp('notified_date'), // When user was notified book is available
    status: varchar('status', { length: 20 }).default('active'), // 'active', 'fulfilled', 'expired', 'cancelled'
    priority: integer('priority').default(1), // Queue position
    reservedBy: integer('reserved_by').references(() => account.id), // Staff who processed reservation
    cancelledBy: integer('cancelled_by').references(() => account.id), // Staff who cancelled (if applicable)
    cancelReason: varchar('cancel_reason', { length: 255 }), // Reason for cancellation
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Penalties and fines table
export const penalty = pgTable('penalty', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).notNull(),
    transactionId: integer('transaction_id').references(() => bookTransaction.id),
    penaltyType: varchar('penalty_type', { length: 30 }).notNull(), // 'overdue_fine', 'damage_fee', 'lost_book_fee', 'late_return'
    amount: integer('amount').notNull(), // Amount in cents (for precise calculation)
    daysOverdue: integer('days_overdue'), // Number of days overdue
    dailyFineRate: integer('daily_fine_rate'), // Fine rate per day in cents
    description: varchar('description', { length: 255 }),
    penaltyDate: timestamp('penalty_date').defaultNow(),
    dueDate: timestamp('due_date'), // When penalty must be paid
    paidAmount: integer('paid_amount').default(0), // Amount paid in cents
    paidDate: timestamp('paid_date'), // When penalty was paid
    status: varchar('status', { length: 20 }).default('unpaid'), // 'unpaid', 'partial', 'paid', 'waived'
    waivedBy: integer('waived_by').references(() => account.id), // Staff who waived the penalty
    waivedReason: varchar('waived_reason', { length: 255 }), // Reason for waiving
    createdBy: integer('created_by').references(() => account.id), // Staff who created penalty
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Penalty payments table
export const penaltyPayment = pgTable('penalty_payment', {
    id: serial('id').primaryKey(),
    penaltyId: integer('penalty_id').references(() => penalty.id).notNull(),
    userId: integer('user_id').references(() => user.id).notNull(),
    paymentAmount: integer('payment_amount').notNull(), // Amount paid in cents
    paymentMethod: varchar('payment_method', { length: 30 }), // 'cash', 'card', 'online', 'bank_transfer'
    transactionRef: varchar('transaction_ref', { length: 100 }), // Payment reference number
    receiptNumber: varchar('receipt_number', { length: 50 }).unique(), // Receipt number
    paymentDate: timestamp('payment_date').defaultNow(),
    processedBy: integer('processed_by').references(() => account.id), // Staff who processed payment
    notes: varchar('notes', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow()
});

// Staff attendance tracking
export const staffAttendance = pgTable('staff_attendance', {
    id: serial('id').primaryKey(),
    accountId: integer('account_id').references(() => account.id).notNull(),
    attendanceDate: date('attendance_date').notNull(),
    clockIn: timestamp('clock_in'),
    clockOut: timestamp('clock_out'),
    totalHours: varchar('total_hours', { length: 10 }), // Format: "8:30" for 8 hours 30 minutes
    status: varchar('status', { length: 20 }).default('present'), // 'present', 'absent', 'half_day', 'late'
    notes: varchar('notes', { length: 500 }), // Optional notes for attendance
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Library visit tracking for physical visitors (students, faculty, and external visitors)
export const libraryVisit = pgTable('library_visit', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id), // Null for external visitors
    visitorName: varchar('visitor_name', { length: 100 }), // For external visitors without user account
    visitorType: varchar('visitor_type', { length: 20 }), // 'student', 'faculty', 'external', 'guest'
    idNumber: varchar('id_number', { length: 50 }), // Student ID, Faculty ID, or external ID
    purpose: varchar('purpose', { length: 100 }), // 'study', 'research', 'book_issue', 'meeting', etc.
    timeIn: timestamp('time_in').notNull(),
    timeOut: timestamp('time_out'),
    duration: varchar('duration', { length: 10 }), // Auto-calculated duration in "HH:MM" format
    status: varchar('status', { length: 20 }).default('checked_in'), // 'checked_in', 'checked_out'
    notes: varchar('notes', { length: 255 }), // Additional notes
    createdAt: timestamp('created_at').defaultNow()
});

// Optional: Library visit summary for analytics
export const visitSummary = pgTable('visit_summary', {
    id: serial('id').primaryKey(),
    summaryDate: date('summary_date').unique().notNull(),
    totalVisitors: integer('total_visitors').default(0),
    studentVisitors: integer('student_visitors').default(0),
    facultyVisitors: integer('faculty_visitors').default(0),
    externalVisitors: integer('external_visitors').default(0),
    averageDuration: varchar('average_duration', { length: 10 }), // Average visit duration
    peakHours: varchar('peak_hours', { length: 50 }), // Most busy hours of the day
    createdAt: timestamp('created_at').defaultNow()
});

// User borrowing limits and preferences
export const userBorrowingProfile = pgTable('user_borrowing_profile', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).unique().notNull(),
    maxBooksAllowed: integer('max_books_allowed').default(3), // Maximum books user can borrow
    currentBooksCount: integer('current_books_count').default(0), // Current borrowed books
    maxReservationsAllowed: integer('max_reservations_allowed').default(2), // Max reservations
    currentReservationsCount: integer('current_reservations_count').default(0), // Current reservations
    borrowingStatus: varchar('borrowing_status', { length: 20 }).default('active'), // 'active', 'suspended', 'restricted'
    suspensionReason: varchar('suspension_reason', { length: 255 }), // Reason for suspension
    suspendedUntil: timestamp('suspended_until'), // When suspension ends
    totalPenaltyAmount: integer('total_penalty_amount').default(0), // Total unpaid penalties
    lastBorrowDate: timestamp('last_borrow_date'),
    memberSince: timestamp('member_since').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Library settings and rules
export const librarySettings = pgTable('library_settings', {
    id: serial('id').primaryKey(),
    settingKey: varchar('setting_key', { length: 50 }).unique().notNull(),
    settingValue: varchar('setting_value', { length: 255 }).notNull(),
    description: varchar('description', { length: 500 }),
    category: varchar('category', { length: 30 }), // 'borrowing', 'penalties', 'reservations', 'general'
    dataType: varchar('data_type', { length: 20 }).default('string'), // 'string', 'integer', 'boolean', 'date'
    isEditable: boolean('is_editable').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Book availability and waiting queue
export const bookWaitingQueue = pgTable('book_waiting_queue', {
    id: serial('id').primaryKey(),
    bookId: integer('book_id').references(() => book.id).notNull(),
    userId: integer('user_id').references(() => user.id).notNull(),
    queuePosition: integer('queue_position').notNull(),
    joinedDate: timestamp('joined_date').defaultNow(),
    estimatedAvailableDate: timestamp('estimated_available_date'),
    notificationSent: boolean('notification_sent').default(false),
    status: varchar('status', { length: 20 }).default('waiting'), // 'waiting', 'notified', 'expired', 'fulfilled'
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Credential audit log
export const credentialAudit = pgTable('credential_audit', {
    id: serial('id').primaryKey(),
    userId: integer('user_id'), // Can reference either account.id or user.id
    userType: varchar('user_type', { length: 20 }).notNull(), // 'account', 'user'
    action: varchar('action', { length: 50 }).notNull(), // 'password_change', 'login_attempt', 'failed_login'
    ipAddress: varchar('ip_address', { length: 45 }), // IPv6 compatible
    userAgent: varchar('user_agent', { length: 500 }),
    success: boolean('success').default(false),
    createdAt: timestamp('created_at').defaultNow()
});