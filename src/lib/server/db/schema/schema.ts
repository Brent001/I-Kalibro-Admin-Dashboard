import { pgTable, serial, integer, varchar, boolean, date } from 'drizzle-orm/pg-core';

// Account table for admin and staff
export const account = pgTable('account', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }),
    email: varchar('email', { length: 100 }).unique(),
    username: varchar('username', { length: 50 }).unique(),
    password: varchar('password', { length: 255 }), // hashed password
    role: varchar('role', { length: 20 }), // 'admin' or 'staff'
    isActive: boolean('is_active').default(true),
    tokenVersion: integer('token_version').default(0) // Add this line
});

// User table with role (student or faculty)
export const user = pgTable('user', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }),
    email: varchar('email', { length: 100 }).unique(),
    role: varchar('role', { length: 20 }), // 'student' or 'faculty'
    age: integer('age')
});

// Student details
export const student = pgTable('student', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id),
    enrollmentNo: varchar('enrollment_no', { length: 30 }).unique(),
    course: varchar('course', { length: 50 })
});

// Faculty details
export const faculty = pgTable('faculty', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id),
    department: varchar('department', { length: 100 }),
    designation: varchar('designation', { length: 50 })
});

// Book table with QR code
export const book = pgTable('book', {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }),
    author: varchar('author', { length: 100 }),
    isbn: varchar('isbn', { length: 20 }).unique(),
    qrCode: varchar('qr_code', { length: 255 }).unique(), // QR code string or URL
    publishedYear: integer('published_year'),
    copiesAvailable: integer('copies_available')
});

// Example: Issued books table (optional, for completeness)
export const issuedBook = pgTable('issued_book', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => user.id),
    bookId: integer('book_id').references(() => book.id),
    issueDate: date('issue_date'),
    returnDate: date('return_date')
});
