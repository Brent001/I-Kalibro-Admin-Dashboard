import { pgTable, serial, integer, varchar, boolean, date, timestamp } from 'drizzle-orm/pg-core';

// Account table for admin and staff
export const account = pgTable('account', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }),
    email: varchar('email', { length: 100 }).unique(),
    username: varchar('username', { length: 50 }).unique(),
    password: varchar('password', { length: 255 }), // hashed password
    role: varchar('role', { length: 20 }), // 'admin' or 'staff'
    isActive: boolean('is_active').default(true),
    tokenVersion: integer('token_version').default(0)
});

// User table with role (student or faculty)
export const user = pgTable('user', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }),
    email: varchar('email', { length: 100 }).unique(),
    phone: varchar('phone', { length: 20 }), // Added phone field
    role: varchar('role', { length: 20 }), // 'student' or 'faculty'
    age: integer('age'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Student details
export const student = pgTable('student', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id),
    enrollmentNo: varchar('enrollment_no', { length: 30 }).unique(),
    course: varchar('course', { length: 50 }),
    year: varchar('year', { length: 20 }), // Added year field for student year/semester
    username: varchar('username', { length: 50 }).unique(),
    password: varchar('password', { length: 255 }), // renamed for consistency
    passwordSalt: varchar('password_salt', { length: 255 }),
    lastPasswordChange: timestamp('last_password_change').defaultNow(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Faculty details
export const faculty = pgTable('faculty', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id),
    department: varchar('department', { length: 100 }),
    designation: varchar('designation', { length: 50 }),
    username: varchar('username', { length: 50 }).unique(),
    password: varchar('password', { length: 255 }), // renamed for consistency
    passwordSalt: varchar('password_salt', { length: 255 }),
    lastPasswordChange: timestamp('last_password_change').defaultNow(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Book table with QR code and category
export const book = pgTable('book', {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }),
    author: varchar('author', { length: 100 }),
    isbn: varchar('isbn', { length: 20 }).unique(),
    qrCode: varchar('qr_code', { length: 255 }).unique(),
    publishedYear: integer('published_year'),
    copiesAvailable: integer('copies_available'),
    categoryId: integer('category_id').references(() => category.id), // Better normalization
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

// Category table for books
export const category = pgTable('category', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 50 }).unique(),
    description: varchar('description', { length: 255 }).default(''),
    createdAt: timestamp('created_at').defaultNow()
});

// Issued books table
export const issuedBook = pgTable('issued_book', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id),
    bookId: integer('book_id').references(() => book.id),
    issueDate: date('issue_date'),
    returnDate: date('return_date'),
    actualReturnDate: date('actual_return_date'), // For tracking late returns
    status: varchar('status', { length: 20 }).default('issued'), // 'issued', 'returned', 'overdue'
    createdAt: timestamp('created_at').defaultNow()
});

// Optional: Separate credential audit table for security tracking
export const credentialAudit = pgTable('credential_audit', {
    id: serial('id').primaryKey(),
    userId: integer('user_id'),
    userType: varchar('user_type', { length: 20 }), // 'account', 'student', 'faculty'
    action: varchar('action', { length: 50 }), // 'password_change', 'login_attempt', 'failed_login'
    ipAddress: varchar('ip_address', { length: 45 }), // IPv6 compatible
    userAgent: varchar('user_agent', { length: 500 }),
    success: boolean('success').default(false),
    createdAt: timestamp('created_at').defaultNow()
});