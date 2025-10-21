import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { user, student, faculty, bookBorrowing } from '$lib/server/db/schema/schema.js';
import { eq, count } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// GET: Return all users (students and faculty) with normalized fields
export const GET: RequestHandler = async () => {
  try {
    const users = await db.select().from(user);

    // Get extra info from student/faculty tables
    const studentInfos = await db.select().from(student);
    const facultyInfos = await db.select().from(faculty);

    // Function to get issued books count for a user
    const getBooksCount = async (userId: number): Promise<number> => {
      const result = await db
        .select({ count: count() })
        .from(bookBorrowing)
        .where(eq(bookBorrowing.userId, userId))
        .where(eq(bookBorrowing.status, 'borrowed'));
      return result[0]?.count ?? 0;
    };

    // Transform users data and add books count and normalized fields
    const members = await Promise.all(
      users.map(async (u) => {
        let extra: any = {};
        if (u.role === 'student') {
          const s = studentInfos.find(stu => stu.userId === u.id);
          if (s) {
            extra = {
              gender: s.gender,
              age: s.age,
              enrollmentNo: s.enrollmentNo,
              course: s.course,
              year: s.year,
              department: s.department
            };
          }
        } else if (u.role === 'faculty') {
          const f = facultyInfos.find(fac => fac.userId === u.id);
          if (f) {
            extra = {
              gender: f.gender,
              age: f.age,
              department: f.department,
              facultyNumber: f.facultyNumber
            };
          }
        }
        return {
          id: u.id,
          type: u.role === 'student' ? 'Student' : 'Faculty',
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          isActive: u.isActive,
          joined: u.createdAt,
          username: u.username,
          booksCount: await getBooksCount(u.id),
          ...extra
        };
      })
    );

    return json({
      success: true,
      data: { members }
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    throw error(500, { message: 'Internal server error' });
  }
};

// POST: Add new member (student or faculty)
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    if (!body.type && body.role) {
      body.type = body.role;
    }

    if (!body.type || !body.name || !body.email || !body.username || !body.password || !body.gender) {
      return new Response(
        JSON.stringify({ message: 'Missing required fields: type, name, email, username, password, gender' }),
        { status: 400 }
      );
    }

    const { type, name, email, phone, age, username, password, gender, enrollmentNo, course, year, department, facultyNumber } = body;

    if (!['Student', 'Faculty'].includes(type)) {
      throw error(400, { message: 'Invalid member type. Must be Student or Faculty' });
    }

    // Check if email or username already exists
    const existingEmail = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      throw error(409, { message: 'Email already exists' });
    }

    const existingUsername = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, username))
      .limit(1);

    if (existingUsername.length > 0) {
      throw error(409, { message: 'Username already exists' });
    }

    // For students, check enrollmentNo
    if (type === 'Student' && enrollmentNo) {
      const existingEnrollment = await db
        .select({ id: student.id })
        .from(student)
        .where(eq(student.enrollmentNo, enrollmentNo))
        .limit(1);

      if (existingEnrollment.length > 0) {
        throw error(409, { message: 'Enrollment number already exists' });
      }
    }

    // For faculty, check facultyNumber
    if (type === 'Faculty' && facultyNumber) {
      const existingFacultyNumber = await db
        .select({ id: faculty.id })
        .from(faculty)
        .where(eq(faculty.facultyNumber, facultyNumber))
        .limit(1);

      if (existingFacultyNumber.length > 0) {
        throw error(409, { message: 'Faculty number already exists' });
      }
    }

    // Hash password
    const passwordSalt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, passwordSalt);

    // Insert into user table
    const [newUser] = await db
      .insert(user)
      .values({
        name,
        email,
        phone: phone || null,
        username,
        password: hashedPassword,
        role: type.toLowerCase(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // Insert into student or faculty table
    if (type === 'Student') {
      await db.insert(student).values({
        userId: newUser.id,
        gender,
        age: typeof age === 'number' ? age : null,
        enrollmentNo,
        course,
        year,
        department
      });
    } else if (type === 'Faculty') {
      await db.insert(faculty).values({
        userId: newUser.id,
        gender,
        age: typeof age === 'number' ? age : null,
        department,
        facultyNumber
      });
    }

    return json({
      success: true,
      message: 'Member added successfully',
      data: {
        id: newUser.id,
        type,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        isActive: newUser.isActive,
        username: newUser.username
      }
    }, { status: 201 });

  } catch (err: any) {
    console.error('Error adding member:', err);
    if (err.status) throw err;
    throw error(500, { message: 'Internal server error' });
  }
};

// PUT: Update member details
export const PUT: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, type, name, email, phone, age, username, password, gender, enrollmentNo, course, year, department, facultyNumber, isActive } = body;

    if (!id) {
      throw error(400, { message: 'Member ID is required' });
    }

    // Check if user exists
    const existingUsers = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    if (existingUsers.length === 0) {
      throw error(404, { message: 'Member not found' });
    }

    // Prepare update data for user table
    let updateData: any = {
      name: name ?? undefined,
      email: email ?? undefined,
      phone: phone ?? undefined,
      username: username ?? undefined,
      isActive: isActive !== undefined ? isActive : undefined,
      updatedAt: new Date(),
    };

    // Hash new password if provided
    if (password) {
      const passwordSalt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, passwordSalt);
      updateData.password = hashedPassword;
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        updateData[key] = null;
      }
    });

    // Update user table
    const [updatedUser] = await db
      .update(user)
      .set(updateData)
      .where(eq(user.id, id))
      .returning();

    // Update student/faculty table
    if (type === 'Student') {
      await db
        .update(student)
        .set({
          gender: gender ?? null,
          age: typeof age === 'number' ? age : null,
          enrollmentNo: enrollmentNo ?? null,
          course: course ?? null,
          year: year ?? null,
          department: department ?? null
        })
        .where(eq(student.userId, id));
    } else if (type === 'Faculty') {
      await db
        .update(faculty)
        .set({
          gender: gender ?? null,
          age: typeof age === 'number' ? age : null,
          department: department ?? null,
          facultyNumber: facultyNumber ?? null
        })
        .where(eq(faculty.userId, id));
    }

    return json({
      success: true,
      message: 'Member updated successfully',
      data: updatedUser
    });

  } catch (err: any) {
    console.error('Error updating member:', err);
    if (err.status) throw err;
    throw error(500, { message: 'Internal server error' });
  }
};

// DELETE: Remove member (soft delete by setting isActive to false)
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, permanent } = body;

    if (!id) {
      throw error(400, { message: 'Member ID is required' });
    }

    // Check if user exists
    const existingUsers = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    if (existingUsers.length === 0) {
      throw error(404, { message: 'Member not found' });
    }

    // Check if user has any issued books
    const issuedBooksCount = await db
      .select({ count: count() })
      .from(bookBorrowing)
      .where(eq(bookBorrowing.userId, id))
      .where(eq(bookBorrowing.status, 'borrowed'));

    if (issuedBooksCount[0].count > 0 && permanent) {
      throw error(400, {
        message: 'Cannot permanently delete member with issued books. Please return all books first.'
      });
    }

    if (permanent) {
      await db.delete(user).where(eq(user.id, id));
      await db.delete(student).where(eq(student.userId, id));
      await db.delete(faculty).where(eq(faculty.userId, id));
      return json({
        success: true,
        message: 'Member permanently deleted'
      });
    } else {
      await db
        .update(user)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(user.id, id));
      return json({
        success: true,
        message: 'Member deactivated successfully'
      });
    }

  } catch (err: any) {
    console.error('Error deleting member:', err);
    if (err.status) throw err;
    throw error(500, { message: 'Internal server error' });
  }
};