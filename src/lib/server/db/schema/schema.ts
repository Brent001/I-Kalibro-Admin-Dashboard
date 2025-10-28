import { pgTable, serial, integer, varchar, boolean, date, timestamp, text, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const staffAccount = pgTable('staff_account', {
    id: serial('id').primaryKey(),
    uniqueId: varchar('unique_id', { length: 36 }).unique().default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 100 }),
    email: varchar('email', { length: 100 }).unique(),
    username: varchar('username', { length: 50 }).unique(),
    password: varchar('password', { length: 255 }),
    role: varchar('role', { length: 20 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const user = pgTable('user', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).unique(),
    phone: varchar('phone', { length: 20 }),
    username: varchar('username', { length: 50 }).unique().notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    role: varchar('role', { length: 20 }).notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

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
    description: varchar('description', { length: 1000 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// UPDATED BORROWING TABLE with fine tracking
export const bookBorrowing = pgTable('book_borrowing', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).notNull(),
    bookId: integer('book_id').references(() => book.id).notNull(),
    borrowDate: date('borrow_date').notNull(),
    dueDate: date('due_date').notNull(),
    returnDate: date('return_date'),
    status: varchar('status', { length: 20 }).default('borrowed'),
    fine: integer('fine').default(0), // Stored in centavos
    fineLastCalculated: timestamp('fine_last_calculated'), // Track when fine was last calculated
    createdAt: timestamp('created_at').defaultNow()
});

export const bookReservation = pgTable('book_reservation', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).notNull(),
    bookId: integer('book_id').references(() => book.id).notNull(),
    reservationDate: date('reservation_date').notNull(),
    status: varchar('status', { length: 20 }).default('active'),
    createdAt: timestamp('created_at').defaultNow()
});

export const libraryVisit = pgTable('library_visit', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id),
    username: varchar('username', { length: 50 }),
    fullName: varchar('full_name', { length: 100 }),
    visitorType: varchar('visitor_type', { length: 20 }),
    purpose: text('purpose'),
    timeIn: timestamp('time_in').notNull(),
    timeOut: timestamp('time_out'),
    createdAt: timestamp('created_at').defaultNow()
});

export const qrCodeToken = pgTable('qr_code_token', {
    id: serial('id').primaryKey(),
    token: varchar('token', { length: 255 }).unique().notNull(),
    type: varchar('type', { length: 30 }).notNull()
});

export const userActivity = pgTable('user_activity', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id).notNull(),
    activityType: varchar('activity_type', { length: 50 }).notNull(),
    activityDetails: varchar('activity_details', { length: 255 }),
    relatedId: integer('related_id'),
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
    staffAccountId: integer('staff_account_id').references(() => staffAccount.id),
    userId: integer('user_id').references(() => user.id),
    eventType: varchar('event_type', { length: 20 }).notNull(),
    eventTime: timestamp('event_time').defaultNow().notNull(),
    browser: varchar('browser', { length: 100 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at').defaultNow()
});

export const staffPermission = pgTable('staff_permission', {
    id: serial('id').primaryKey(),
    staffUniqueId: varchar('staff_unique_id', { length: 36 }).references(() => staffAccount.uniqueId).unique().notNull(),
    permissionKeys: jsonb('permission_keys').notNull(),
    createdAt: timestamp('created_at').defaultNow()
});