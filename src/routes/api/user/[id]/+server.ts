// File: src/routes/api/user/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { tbl_user, tbl_student, tbl_faculty, tbl_book_borrowing, tbl_book, tbl_return } from '$lib/server/db/schema/schema.js';
import { eq, count, and } from 'drizzle-orm';

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
      .from(tbl_user)
      .where(eq(tbl_user.id, userId))
      .limit(1);

    if (userInfoArr.length === 0) {
      throw error(404, { message: 'User not found' });
    }

    const u = userInfoArr[0];
    let memberDetails: any = {
      ...u
    };

    // Get extra info from student/faculty table - check which type of user this is
    const [studentInfo] = await db
      .select()
      .from(tbl_student)
      .where(eq(tbl_student.userId, userId))
      .limit(1);
    
    if (studentInfo) {
      memberDetails.userType = 'student';
      memberDetails.enrollmentNo = studentInfo.enrollmentNo;
      memberDetails.course = studentInfo.course;
      memberDetails.year = studentInfo.year;
      memberDetails.department = studentInfo.department;
    } else {
      const [facultyInfo] = await db
        .select()
        .from(tbl_faculty)
        .where(eq(tbl_faculty.userId, userId))
        .limit(1);
      if (facultyInfo) {
        memberDetails.userType = 'faculty';
        memberDetails.facultyNumber = facultyInfo.facultyNumber;
        memberDetails.position = facultyInfo.position;
        memberDetails.department = facultyInfo.department;
      }
    }

    // Get issued books count (only book borrowing for now, can extend to other types)
    const issuedBooksCountResult = await db
      .select({ count: count() })
      .from(tbl_book_borrowing)
      .where(and(eq(tbl_book_borrowing.userId, userId), eq(tbl_book_borrowing.status, 'borrowed')));
    const issuedBooksCount = issuedBooksCountResult[0]?.count ?? 0;

    // Get active borrowings
    const issuedBooksRaw = await db
      .select({
        id: tbl_book_borrowing.id,
        bookTitle: tbl_book.title,
        bookAuthor: tbl_book.author,
        borrowDate: tbl_book_borrowing.borrowDate,
        dueDate: tbl_book_borrowing.dueDate,
        status: tbl_book_borrowing.status
      })
      .from(tbl_book_borrowing)
      .leftJoin(tbl_book, eq(tbl_book_borrowing.bookId, tbl_book.id))
      .where(and(eq(tbl_book_borrowing.userId, userId), eq(tbl_book_borrowing.status, 'borrowed')));

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

    // Get returned books from tbl_return
    const returnedBooksRaw = await db
      .select({
        id: tbl_return.id,
        bookTitle: tbl_book.title,
        bookAuthor: tbl_book.author,
        returnDate: tbl_return.returnDate
      })
      .from(tbl_return)
      .leftJoin(tbl_book_borrowing, eq(tbl_return.borrowingId, tbl_book_borrowing.id))
      .leftJoin(tbl_book, eq(tbl_book_borrowing.bookId, tbl_book.id))
      .where(eq(tbl_book_borrowing.userId, userId));

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