// File: src/routes/api/user/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { user, student, faculty, issuedBook, book } from '$lib/server/db/schema/schema.js';
import { eq, count } from 'drizzle-orm';

// GET: Return specific user details with issued books
export const GET: RequestHandler = async ({ params }) => {
  try {
    const userId = parseInt(params.id);
    
    if (isNaN(userId)) {
      throw error(400, { message: 'Invalid user ID' });
    }

    // Get user basic info
    const userInfo = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        age: user.age,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (userInfo.length === 0) {
      throw error(404, { message: 'User not found' });
    }

    const userRecord = userInfo[0];
    let memberDetails: any = {
      ...userRecord,
      type: userRecord.role === 'student' ? 'Student' : 'Faculty'
    };

    // Get type-specific details
    if (userRecord.role === 'student') {
      const studentInfo = await db
        .select({
          enrollmentNo: student.enrollmentNo,
          course: student.course,
          year: student.year,
          username: student.username,
          isActive: student.isActive,
          createdAt: student.createdAt,
        })
        .from(student)
        .where(eq(student.userId, userId))
        .limit(1);

      if (studentInfo.length > 0) {
        memberDetails = { ...memberDetails, ...studentInfo[0] };
      }
    } else {
      const facultyInfo = await db
        .select({
          department: faculty.department,
          designation: faculty.designation,
          username: faculty.username,
          isActive: faculty.isActive,
          createdAt: faculty.createdAt,
        })
        .from(faculty)
        .where(eq(faculty.userId, userId))
        .limit(1);

      if (facultyInfo.length > 0) {
        memberDetails = { ...memberDetails, ...facultyInfo[0] };
      }
    }

    // Get issued books count
    const issuedBooksCount = await db
      .select({ count: count() })
      .from(issuedBook)
      .where(eq(issuedBook.userId, userId));

    // Get detailed issued books information
    const issuedBooks = await db
      .select({
        id: issuedBook.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        bookIsbn: book.isbn,
        issueDate: issuedBook.issueDate,
        returnDate: issuedBook.returnDate,
        actualReturnDate: issuedBook.actualReturnDate,
        status: issuedBook.status,
        isOverdue: db.raw(`CASE 
          WHEN issued_book.actual_return_date IS NULL AND issued_book.return_date < CURRENT_DATE 
          THEN true 
          ELSE false 
        END`),
      })
      .from(issuedBook)
      .leftJoin(book, eq(issuedBook.bookId, book.id))
      .where(eq(issuedBook.userId, userId));

    memberDetails.booksCount = issuedBooksCount[0]?.count ?? 0;
    memberDetails.issuedBooks = issuedBooks;

    return json({
      success: true,
      data: memberDetails
    });

  } catch (err: any) {
    console.error('Error fetching user details:', err);
    if (err.status) throw err;
    throw error(500, { message: 'Internal server error' });
  }
};