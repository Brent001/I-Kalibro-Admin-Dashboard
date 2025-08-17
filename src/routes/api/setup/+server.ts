import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { account } from '$lib/server/db/schema/schema.js';
import { eq, count } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import type { ZodIssue } from 'zod';

// Input validation schema
const setupSchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(100, 'Name must be less than 100 characters')
        .trim(),
    email: z.string()
        .email('Invalid email format')
        .max(100, 'Email must be less than 100 characters')
        .toLowerCase(),
    username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must be less than 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
        .trim(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(255, 'Password is too long')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
               'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character')
});

export const POST: RequestHandler = async ({ request }) => {
    try {
        // Parse and validate JSON body
        const body = await request.json();
        const validationResult = setupSchema.safeParse(body);
        
        if (!validationResult.success) {
            const errors = validationResult.error.issues.map((err: ZodIssue) => ({
                field: err.path.join('.'),
                message: err.message
            }));
            
            return new Response(
                JSON.stringify({ 
                    success: false, 
                    message: 'Validation failed', 
                    errors 
                }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { name, email, username, password } = validationResult.data;

        // Check if setup is already completed
        const [{ count: accountCount }] = await db
            .select({ count: count() })
            .from(account);
            
        if (accountCount > 0) {
            return new Response(
                JSON.stringify({ 
                    success: false, 
                    message: 'System setup has already been completed.' 
                }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Check for duplicate email or username (additional safety check)
        const existingAccount = await db
            .select()
            .from(account)
            .where(eq(account.email, email))
            .limit(1);

        const existingUsername = await db
            .select()
            .from(account)
            .where(eq(account.username, username))
            .limit(1);

        if (existingAccount.length > 0) {
            return new Response(
                JSON.stringify({ 
                    success: false, 
                    message: 'Email already exists.' 
                }),
                { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (existingUsername.length > 0) {
            return new Response(
                JSON.stringify({ 
                    success: false, 
                    message: 'Username already exists.' 
                }),
                { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Hash the password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create admin account
        const [admin] = await db
            .insert(account)
            .values({
                name,
                email,
                username,
                password: hashedPassword,
                role: 'admin',
                isActive: true
            })
            .returning({
                id: account.id,
                name: account.name,
                email: account.email,
                username: account.username,
                role: account.role,
                isActive: account.isActive
            });

        // Log successful setup (consider using a proper logging library)
        console.log(`Admin account created successfully: ${admin.email}`);

        return new Response(
            JSON.stringify({ 
                success: true, 
                message: 'Admin account created successfully.',
                user: admin
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        // Log the error (consider using a proper logging library)
        console.error('Setup API error:', error);

        // Don't expose internal error details to the client
        return new Response(
            JSON.stringify({ 
                success: false, 
                message: 'An internal server error occurred. Please try again later.' 
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

// Optional: GET endpoint to check setup status
export const GET: RequestHandler = async () => {
    try {
        const [{ count: accountCount }] = await db
            .select({ count: count() })
            .from(account);
            
        return new Response(
            JSON.stringify({ 
                setupCompleted: accountCount > 0 
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Setup status check error:', error);
        
        return new Response(
            JSON.stringify({ 
                success: false, 
                message: 'Unable to check setup status.' 
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};