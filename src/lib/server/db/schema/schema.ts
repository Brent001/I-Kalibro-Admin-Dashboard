import { pgTable, serial, integer, varchar, boolean, date, timestamp } from 'drizzle-orm/pg-core';

// Rename account table to staffAccount
export const staffAccount = pgTable('staff_account', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }),
    email: varchar('email', { length: 100 }).unique(),
    username: varchar('username', { length: 50 }).unique(),
    password: varchar('password', { length: 255 }),
    role: varchar('role', { length: 20 }), // 'admin' or 'staff'
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// User table: authentication and common info for students/faculty
export const user = pgTable('user', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).unique(),
    phone: varchar('phone', { length: 20 }),
    username: varchar('username', { length: 50 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    role: varchar('role', { length: 20 }).notNull(), // 'student' or 'faculty'
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Student table: student-specific info
export const student = pgTable('student', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).unique().notNull(),
    gender: varchar('gender', { length: 20 }),
    age: integer('age'),
    enrollmentNo: varchar('enrollment_no', { length: 30 }).unique(),
    course: varchar('course', { length: 50 }),
    year: varchar('year', { length: 20 }),
    department: varchar('department', { length: 100 })
});

// Faculty table: faculty-specific info
export const faculty = pgTable('faculty', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).unique().notNull(),
    gender: varchar('gender', { length: 20 }),
    age: integer('age'),
    department: varchar('department', { length: 100 }),
    facultyNumber: varchar('faculty_number', { length: 30 }).unique()
});

export const category = pgTable('category', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 50 }).unique().notNull(),
    description: varchar('description', { length: 255 }).default(''),
    createdAt: timestamp('created_at').defaultNow()
});

export const book = pgTable('book', {
    id: serial('id').primaryKey(),
    bookId: varchar('book_id', { length: 30 }).unique().notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    author: varchar('author', { length: 100 }),
    language: varchar('language', { length: 50 }),
    originPlace: varchar('origin_place', { length: 100 }),
    publishedYear: integer('published_year'),
    copiesAvailable: integer('copies_available').default(0),
    categoryId: integer('category_id').references(() => category.id),
    publisher: varchar('publisher', { length: 100 }),
    location: varchar('location', { length: 100 }),
    description: varchar('description', { length: 1000 }), // <-- Book description is now optional
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// SIMPLIFIED BORROWING TABLE
export const bookBorrowing = pgTable('book_borrowing', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).notNull(),
    bookId: integer('book_id').references(() => book.id).notNull(),
    borrowDate: date('borrow_date').notNull(),
    dueDate: date('due_date').notNull(),
    returnDate: date('return_date'), // null if not returned yet
    status: varchar('status', { length: 20 }).default('borrowed'), // 'borrowed', 'returned', 'overdue'
    fine: integer('fine').default(0), // <-- Add this line
    createdAt: timestamp('created_at').defaultNow()
});

// SIMPLIFIED RESERVATIONS TABLE
export const bookReservation = pgTable('book_reservation', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).notNull(),
    bookId: integer('book_id').references(() => book.id).notNull(),
    reservationDate: date('reservation_date').notNull(),
    status: varchar('status', { length: 20 }).default('active'), // 'active', 'fulfilled', 'cancelled'
    createdAt: timestamp('created_at').defaultNow()
});

// Keep other essential tables
export const libraryVisit = pgTable('library_visit', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id),
    username: varchar('username', { length: 50 }),
    fullName: varchar('full_name', { length: 100 }),
    visitorType: varchar('visitor_type', { length: 20 }),
    timeIn: timestamp('time_in').notNull(),
    timeOut: timestamp('time_out'),
    createdAt: timestamp('created_at').defaultNow()
});

export const qrCodeToken = pgTable('qr_code_token', {
    id: serial('id').primaryKey(),
    token: varchar('token', { length: 255 }).unique().notNull(),
    type: varchar('type', { length: 30 }).notNull() // e.g. 'library_visit', 'book'
});

export const userActivity = pgTable('user_activity', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).notNull(),
    activityType: varchar('activity_type', { length: 50 }).notNull(), // e.g. 'borrow', 'return', 'reserve', 'visit'
    activityDetails: varchar('activity_details', { length: 255 }), // optional details (book title, etc.)
    relatedId: integer('related_id'), // e.g. bookBorrowing.id, bookReservation.id, libraryVisit.id
    timestamp: timestamp('timestamp').defaultNow().notNull()
});

export const bookReturn = pgTable('book_return', {
    id: serial('id').primaryKey(),
    borrowingId: integer('borrowing_id').references(() => bookBorrowing.id).notNull(),
    userId: integer('user_id').references(() => user.id).notNull(),
    bookId: integer('book_id').references(() => book.id).notNull(),
    returnDate: date('return_date').notNull(),
    finePaid: integer('fine_paid').default(0),
    remarks: varchar('remarks', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow()
});

export const paymentInfo = pgTable('payment_info', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).notNull(),
    borrowingId: integer('borrowing_id').references(() => bookBorrowing.id),
    totalAmount: integer('total_amount').notNull(),
    fineAmount: integer('fine_amount').default(0),
    paymentDate: timestamp('payment_date').defaultNow(),
    createdAt: timestamp('created_at').defaultNow()
});

export const securityLog = pgTable('security_log', {
    id: serial('id').primaryKey(),
    staffAccountId: integer('staff_account_id').references(() => staffAccount.id), // <-- Add this line
    userId: integer('user_id').references(() => user.id),
    eventType: varchar('event_type', { length: 20 }).notNull(), // 'login' or 'logout'
    eventTime: timestamp('event_time').defaultNow().notNull(),
    browser: varchar('browser', { length: 100 }),
    ipAddress: varchar('ip_address', { length: 45 }), // optional: for IPv4/IPv6
    createdAt: timestamp('created_at').defaultNow()
});