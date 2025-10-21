// File: src/routes/api/user/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { user, student, faculty, bookBorrowing, book, bookReturn } from '$lib/server/db/schema/schema.js';
import { eq, count } from 'drizzle-orm';

// GET: Return specific user details with issued and returned books, using new schema
export const GET: RequestHandler = async ({ params }) => {
  try {
    const userId = parseInt(params.id);

    if (isNaN(userId)) {
      throw error(400, { message: 'Invalid user ID' });
    }

    // Get user basic info
    const userInfoArr = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (userInfoArr.length === 0) {
      throw error(404, { message: 'User not found' });
    }

    const u = userInfoArr[0];
    let memberDetails: any = {
      ...u,
      type: u.role === 'student' ? 'Student' : 'Faculty'
    };

    // Get extra info from student/faculty table
    if (u.role === 'student') {
      const [studentInfo] = await db
        .select()
        .from(student)
        .where(eq(student.userId, userId))
        .limit(1);
      if (studentInfo) {
        memberDetails.gender = studentInfo.gender;
        memberDetails.age = studentInfo.age;
        memberDetails.enrollmentNo = studentInfo.enrollmentNo;
        memberDetails.course = studentInfo.course;
        memberDetails.year = studentInfo.year;
        memberDetails.department = studentInfo.department;
      }
    } else if (u.role === 'faculty') {
      const [facultyInfo] = await db
        .select()
        .from(faculty)
        .where(eq(faculty.userId, userId))
        .limit(1);
      if (facultyInfo) {
        memberDetails.gender = facultyInfo.gender;
        memberDetails.age = facultyInfo.age;
        memberDetails.department = facultyInfo.department;
        memberDetails.facultyNumber = facultyInfo.facultyNumber;
      }
    }

    // Get issued books count
    const issuedBooksCountResult = await db
      .select({ count: count() })
      .from(bookBorrowing)
      .where(eq(bookBorrowing.userId, userId))
      .where(eq(bookBorrowing.status, 'borrowed'));
    const issuedBooksCount = issuedBooksCountResult[0]?.count ?? 0;

    // Get active borrowings
    const issuedBooksRaw = await db
      .select({
        id: bookBorrowing.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        borrowDate: bookBorrowing.borrowDate,
        dueDate: bookBorrowing.dueDate,
        status: bookBorrowing.status
      })
      .from(bookBorrowing)
      .leftJoin(book, eq(bookBorrowing.bookId, book.id))
      .where(eq(bookBorrowing.userId, userId))
      .where(eq(bookBorrowing.status, 'borrowed'));

    // Calculate fines for each active borrowing
    const issuedBooks = issuedBooksRaw.map(b => {
      const now = new Date();
      const due = new Date(b.dueDate);
      let fine = 0;
      if (now > due) {
        const msPerHour = 1000 * 60 * 60;
        const overdueMs = now.getTime() - due.getTime();
        const overdueHours = Math.ceil(overdueMs / msPerHour);
        fine = overdueHours * 5;
      }
      return { ...b, fine };
    });

    // Get returned books from bookReturn
    const returnedBooksRaw = await db
      .select({
        id: bookReturn.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        returnDate: bookReturn.returnDate,
        finePaid: bookReturn.finePaid,
        remarks: bookReturn.remarks
      })
      .from(bookReturn)
      .leftJoin(book, eq(bookReturn.bookId, book.id))
      .where(eq(bookReturn.userId, userId));

    memberDetails.booksCount = issuedBooks.length;
    memberDetails.issuedBooks = issuedBooks;
    memberDetails.returnedBooks = returnedBooksRaw;

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