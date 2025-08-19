import type { PageServerLoad, Actions } from './$types.js';
import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { account } from '$lib/server/db/schema/schema.js';
import { eq, count } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { z } from 'zod';

// Input validation schema matching the API
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
               'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    confirmPassword: z.string()
});

// Helper function to check if setup is completed
async function isSetupCompleted(): Promise<boolean> {
    try {
        const [{ count: userCount }] = await db.select({ count: count() }).from(account);
        return userCount > 0;
    } catch (error) {
        console.error('Error checking setup status:', error);
        // If we can't check, assume setup is needed to avoid blocking access
        return false;
    }
}

export const load: PageServerLoad = async () => {
    // Check if setup is already completed
    const setupCompleted = await isSetupCompleted();
    
    if (setupCompleted) {
        // Force redirect to login if setup is already done
        throw redirect(302, '/');
    }

    // Setup is needed, allow access to setup page
    return {
        setupRequired: true
    };
};

export const actions: Actions = {
    default: async ({ request }) => {
        try {
            // Double-check setup status before processing form
            const setupCompleted = await isSetupCompleted();
            
            if (setupCompleted) {
                return fail(403, { 
                    errorMsg: 'System setup has already been completed. Please use the login page.' 
                });
            }

            const formData = await request.formData();
            
            // Extract form data
            const formFields = {
                name: formData.get('name') as string,
                email: formData.get('email') as string,
                username: formData.get('username') as string,
                password: formData.get('password') as string,
                confirmPassword: formData.get('confirmPassword') as string
            };

            // Basic null checks
            if (!formFields.name || !formFields.email || !formFields.username || 
                !formFields.password || !formFields.confirmPassword) {
                return fail(400, { 
                    errorMsg: 'All fields are required.',
                    ...formFields // Preserve form data
                });
            }

            // Password confirmation check
            if (formFields.password !== formFields.confirmPassword) {
                return fail(400, { 
                    errorMsg: 'Passwords do not match.',
                    ...formFields,
                    password: '', // Clear passwords on error
                    confirmPassword: ''
                });
            }

            // Validate with Zod schema
            const validationResult = setupSchema.safeParse(formFields);
            
            if (!validationResult.success) {
                const firstError = validationResult.error.issues[0];
                return fail(400, { 
                    errorMsg: firstError.message,
                    ...formFields,
                    password: '', // Clear passwords on validation error
                    confirmPassword: ''
                });
            }

            const { name, email, username, password } = validationResult.data;

            // Final check before creating account (race condition protection)
            const finalCheck = await isSetupCompleted();
            if (finalCheck) {
                return fail(403, { 
                    errorMsg: 'System setup has already been completed by another user.' 
                });
            }

            // Check for duplicate email (shouldn't happen in first setup, but good to have)
            const existingEmail = await db
                .select()
                .from(account)
                .where(eq(account.email, email))
                .limit(1);

            if (existingEmail.length > 0) {
                return fail(409, { 
                    errorMsg: 'Email address is already registered.',
                    ...formFields,
                    password: '',
                    confirmPassword: ''
                });
            }

            // Check for duplicate username
            const existingUsername = await db
                .select()
                .from(account)
                .where(eq(account.username, username))
                .limit(1);

            if (existingUsername.length > 0) {
                return fail(409, { 
                    errorMsg: 'Username is already taken.',
                    ...formFields,
                    password: '',
                    confirmPassword: ''
                });
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
                    role: account.role
                });

            // Log successful setup
            console.log(`Admin account created successfully: ${admin.email}`);

            // Redirect to login page after successful setup
            throw redirect(303, '/login?setup=success');

        } catch (error) {
            // If it's a redirect, re-throw it
            if (error instanceof Response) {
                throw error;
            }

            console.error('Setup action error:', error);
            
            return fail(500, { 
                errorMsg: 'An internal error occurred. Please try again later.' 
            });
        }
    }
};