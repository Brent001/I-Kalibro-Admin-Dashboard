import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { user, student, faculty, issuedBook } from '$lib/server/db/schema/schema.js';
import { eq, count, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// GET: Return all users (students and faculty) with normalized fields
export const GET: RequestHandler = async () => {
  try {
    // Get all students with their details
    const studentsQuery = db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        age: user.age,
        createdAt: user.createdAt,
        enrollmentNo: student.enrollmentNo,
        course: student.course,
        year: student.year,
        isActive: student.isActive,
      })
      .from(user)
      .innerJoin(student, eq(student.userId, user.id))
      .where(eq(user.role, 'student'));

    // Get all faculty with their details  
    const facultiesQuery = db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        age: user.age,
        createdAt: user.createdAt,
        department: faculty.department,
        designation: faculty.designation,
        isActive: faculty.isActive,
      })
      .from(user)
      .innerJoin(faculty, eq(faculty.userId, user.id))
      .where(eq(user.role, 'faculty'));

    const [students, faculties] = await Promise.all([
      studentsQuery,
      facultiesQuery
    ]);

    // Function to get issued books count for a user
    const getBooksCount = async (userId: number): Promise<number> => {
      const result = await db
        .select({ count: count() })
        .from(issuedBook)
        .where(eq(issuedBook.userId, userId));
      return result[0]?.count ?? 0;
    };

    // Transform students data and add books count
    const studentsWithBooks = await Promise.all(
      students.map(async (student) => ({
        id: student.id,
        type: 'Student' as const,
        name: student.name,
        email: student.email,
        phone: student.phone,
        role: student.role,
        age: student.age,
        enrollmentNo: student.enrollmentNo,
        course: student.course,
        year: student.year,
        isActive: student.isActive,
        joined: student.createdAt,
        booksCount: await getBooksCount(student.id),
      }))
    );

    // Transform faculties data and add books count
    const facultiesWithBooks = await Promise.all(
      faculties.map(async (faculty) => ({
        id: faculty.id,
        type: 'Faculty' as const,
        name: faculty.name,
        email: faculty.email,
        phone: faculty.phone,
        role: faculty.role,
        age: faculty.age,
        department: faculty.department,
        designation: faculty.designation,
        isActive: faculty.isActive,
        joined: faculty.createdAt,
        booksCount: await getBooksCount(faculty.id),
      }))
    );

    const members = [...studentsWithBooks, ...facultiesWithBooks];

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
    const { type, name, email, phone, age, ...typeSpecificData } = body;

    // Validate required fields
    if (!type || !name || !email) {
      throw error(400, { message: 'Missing required fields: type, name, email' });
    }

    if (!['Student', 'Faculty'].includes(type)) {
      throw error(400, { message: 'Invalid member type. Must be Student or Faculty' });
    }

    // Check if email already exists
    const existingUsers = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existingUsers.length > 0) {
      throw error(409, { message: 'Email already exists' });
    }

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Create user record
      const [newUser] = await tx
        .insert(user)
        .values({
          name,
          email,
          phone,
          role: type.toLowerCase(),
          age: age || null,
        })
        .returning();

      if (type === 'Student') {
        const { enrollmentNo, course, year, username, password } = typeSpecificData;
        
        if (!enrollmentNo || !course) {
          throw error(400, { message: 'Missing required student fields: enrollmentNo, course' });
        }

        // Check if enrollment number already exists
        const existingStudents = await tx
          .select({ id: student.id })
          .from(student)
          .where(eq(student.enrollmentNo, enrollmentNo))
          .limit(1);

        if (existingStudents.length > 0) {
          throw error(409, { message: 'Enrollment number already exists' });
        }

        // Hash password if provided
        let hashedPassword = null;
        let passwordSalt = null;
        if (password) {
          passwordSalt = await bcrypt.genSalt(10);
          hashedPassword = await bcrypt.hash(password, passwordSalt);
        }

        // Create student record
        const [newStudent] = await tx
          .insert(student)
          .values({
            userId: newUser.id,
            enrollmentNo,
            course,
            year: year || null,
            username: username || null,
            password: hashedPassword,
            passwordSalt,
            isActive: true,
          })
          .returning();

        return {
          id: newUser.id,
          type: 'Student',
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          enrollmentNo: newStudent.enrollmentNo,
          course: newStudent.course,
          year: newStudent.year,
          isActive: newStudent.isActive,
          booksCount: 0,
        };
      } else {
        const { department, designation, username, password } = typeSpecificData;
        
        if (!department) {
          throw error(400, { message: 'Missing required faculty field: department' });
        }

        // Hash password if provided
        let hashedPassword = null;
        let passwordSalt = null;
        if (password) {
          passwordSalt = await bcrypt.genSalt(10);
          hashedPassword = await bcrypt.hash(password, passwordSalt);
        }

        // Create faculty record
        const [newFaculty] = await tx
          .insert(faculty)
          .values({
            userId: newUser.id,
            department,
            designation: designation || null,
            username: username || null,
            password: hashedPassword,
            passwordSalt,
            isActive: true,
          })
          .returning();

        return {
          id: newUser.id,
          type: 'Faculty',
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          department: newFaculty.department,
          designation: newFaculty.designation,
          isActive: newFaculty.isActive,
          booksCount: 0,
        };
      }
    });

    return json({
      success: true,
      message: 'Member added successfully',
      data: result
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
    const { id, type, name, email, phone, age, ...typeSpecificData } = body;

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

    const userRole = existingUsers[0].role;

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Update user record
      const [updatedUser] = await tx
        .update(user)
        .set({
          name: name || undefined,
          email: email || undefined,
          phone: phone || undefined,
          age: age || undefined,
          updatedAt: new Date(),
        })
        .where(eq(user.id, id))
        .returning();

      if (userRole === 'student') {
        const { enrollmentNo, course, year, isActive, password } = typeSpecificData;
        
        let updateData: any = {
          enrollmentNo: enrollmentNo || undefined,
          course: course || undefined,
          year: year || undefined,
          isActive: isActive !== undefined ? isActive : undefined,
          updatedAt: new Date(),
        };

        // Hash new password if provided
        if (password) {
          const passwordSalt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, passwordSalt);
          updateData.password = hashedPassword;
          updateData.passwordSalt = passwordSalt;
          updateData.lastPasswordChange = new Date();
        }

        // Remove undefined values
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) {
            delete updateData[key];
          }
        });

        const [updatedStudent] = await tx
          .update(student)
          .set(updateData)
          .where(eq(student.userId, id))
          .returning();

        return {
          id: updatedUser.id,
          type: 'Student',
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          enrollmentNo: updatedStudent.enrollmentNo,
          course: updatedStudent.course,
          year: updatedStudent.year,
          isActive: updatedStudent.isActive,
        };
      } else {
        const { department, designation, isActive, password } = typeSpecificData;
        
        let updateData: any = {
          department: department || undefined,
          designation: designation || undefined,
          isActive: isActive !== undefined ? isActive : undefined,
          updatedAt: new Date(),
        };

        // Hash new password if provided
        if (password) {
          const passwordSalt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, passwordSalt);
          updateData.password = hashedPassword;
          updateData.passwordSalt = passwordSalt;
          updateData.lastPasswordChange = new Date();
        }

        // Remove undefined values
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) {
            delete updateData[key];
          }
        });

        const [updatedFaculty] = await tx
          .update(faculty)
          .set(updateData)
          .where(eq(faculty.userId, id))
          .returning();

        return {
          id: updatedUser.id,
          type: 'Faculty',
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          department: updatedFaculty.department,
          designation: updatedFaculty.designation,
          isActive: updatedFaculty.isActive,
        };
      }
    });

    return json({
      success: true,
      message: 'Member updated successfully',
      data: result
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

    const userRole = existingUsers[0].role;

    // Check if user has any issued books
    const issuedBooksCount = await db
      .select({ count: count() })
      .from(issuedBook)
      .where(eq(issuedBook.userId, id));

    if (issuedBooksCount[0].count > 0 && permanent) {
      throw error(400, { 
        message: 'Cannot permanently delete member with issued books. Please return all books first.' 
      });
    }

    if (permanent) {
      // Permanent deletion
      await db.transaction(async (tx) => {
        // Delete type-specific record first (foreign key constraint)
        if (userRole === 'student') {
          await tx.delete(student).where(eq(student.userId, id));
        } else {
          await tx.delete(faculty).where(eq(faculty.userId, id));
        }
        
        // Delete user record
        await tx.delete(user).where(eq(user.id, id));
      });

      return json({
        success: true,
        message: 'Member permanently deleted'
      });
    } else {
      // Soft delete (deactivate)
      await db.transaction(async (tx) => {
        if (userRole === 'student') {
          await tx
            .update(student)
            .set({ 
              isActive: false, 
              updatedAt: new Date() 
            })
            .where(eq(student.userId, id));
        } else {
          await tx
            .update(faculty)
            .set({ 
              isActive: false, 
              updatedAt: new Date() 
            })
            .where(eq(faculty.userId, id));
        }
      });

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