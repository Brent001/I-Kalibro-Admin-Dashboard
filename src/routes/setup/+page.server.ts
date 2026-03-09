import type { PageServerLoad, Actions } from './$types.js';
import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { tbl_super_admin } from '$lib/server/db/schema/schema.js';
import { eq, count } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { z } from 'zod';

// add these types
type SetupData = {
    name: string;
    email: string;
    username: string;
    password: string;
    confirmPassword: string;
};

type ValidationResult = {
    success: boolean;
    error?: string;
    data?: SetupData;
};

// Validation schema
const setupSchema = z.object({
    name: z.string()
        .min(1, 'Full name is required')
        .max(100, 'Name must not exceed 100 characters')
        .trim(),
    email: z.string()
        .email('Please enter a valid email address')
        .max(100, 'Email must not exceed 100 characters')
        .toLowerCase(),
    username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
        .trim(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(255, 'Password is too long')
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
            'Password must contain uppercase, lowercase, number, and special character'
        ),
    confirmPassword: z.string()
});

// Helper functions
async function isSetupCompleted(): Promise<boolean> {
    try {
        const [{ userCount }] = await db
            .select({ userCount: count() })
            .from(tbl_super_admin);
        
        return userCount > 0;
    } catch (error) {
        console.error('[Setup] Error checking setup status:', error);
        return false;
    }
}

function validateFormData(formFields: Record<string, string>): ValidationResult {
    const { password, confirmPassword } = formFields;
    
    if (password !== confirmPassword) {
        return {
            success: false,
            error: 'Passwords do not match'
        };
    }

    const validationResult = setupSchema.safeParse(formFields);
    
    if (!validationResult.success) {
        const firstError = validationResult.error.issues[0];
        return {
            success: false,
            error: firstError.message
        };
    }

    return {
        success: true,
        data: validationResult.data as SetupData
    };
}

async function checkDuplicates(email: string, username: string) {
    try {
        const [emailExists, usernameExists] = await Promise.all([
            db.select({ id: tbl_super_admin.id })
                .from(tbl_super_admin)
                .where(eq(tbl_super_admin.email, email))
                .limit(1),
            db.select({ id: tbl_super_admin.id })
                .from(tbl_super_admin)
                .where(eq(tbl_super_admin.username, username))
                .limit(1)
        ]);

        if (emailExists.length > 0) {
            return { 
                duplicate: 'email', 
                message: 'Email address is already registered' 
            };
        }

        if (usernameExists.length > 0) {
            return { 
                duplicate: 'username', 
                message: 'Username is already taken' 
            };
        }

        return null;
    } catch (error) {
        console.error('[Setup] Error checking duplicates:', error);
        throw new Error('Database error while checking duplicates');
    }
}

async function hashPassword(password: string): Promise<string> {
    try {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    } catch (error) {
        console.error('[Setup] Error hashing password:', error);
        throw new Error('Failed to hash password');
    }
}

async function createAdminAccount(
    name: string,
    email: string,
    username: string,
    hashedPassword: string
) {
    try {
        const [admin] = await db
            .insert(tbl_super_admin)
            .values({
                name,
                email,
                username,
                password: hashedPassword,
                isActive: true
            })
            .returning({
                id: tbl_super_admin.id,
                name: tbl_super_admin.name,
                email: tbl_super_admin.email,
                username: tbl_super_admin.username
            });

        return admin;
    } catch (error) {
        console.error('[Setup] Error creating admin account:', error);
        throw new Error('Failed to create admin account');
    }
}

// Page load
export const load: PageServerLoad = async () => {
    const setupCompleted = await isSetupCompleted();
    
    if (setupCompleted) {
        // Redirect to login if setup is completed
        throw redirect(302, '/');
    }

    return {
        setupRequired: true
    };
};

// Form actions
export const actions: Actions = {
    default: async ({ request, locals }) => {
        const formData = await request.formData();
        const formFields = {
            name: (formData.get('name') as string) || '',
            email: (formData.get('email') as string) || '',
            username: (formData.get('username') as string) || '',
            password: (formData.get('password') as string) || '',
            confirmPassword: (formData.get('confirmPassword') as string) || ''
        };

        try {
            // Check if setup already completed
            const setupCompleted = await isSetupCompleted();
            
            if (setupCompleted) {
                return fail(403, {
                    errorMsg: 'System setup has already been completed. Please log in instead.',
                    name: formFields.name,
                    email: formFields.email,
                    username: formFields.username
                });
            }

            // Validate form data
            const validation = validateFormData(formFields);
            
            if (!validation.success || !validation.data) {
                return fail(400, {
                    errorMsg: validation.error,
                    name: formFields.name,
                    email: formFields.email,
                    username: formFields.username
                });
            }

            const { name, email, username, password } = validation.data;

            // Final race condition check
            const finalCheck = await isSetupCompleted();
            if (finalCheck) {
                return fail(403, {
                    errorMsg: 'System setup has already been completed by another user.',
                    name: formFields.name,
                    email: formFields.email,
                    username: formFields.username
                });
            }

            // Check duplicates
            const duplicateCheck = await checkDuplicates(email, username);
            
            if (duplicateCheck) {
                return fail(409, {
                    errorMsg: duplicateCheck.message,
                    name: formFields.name,
                    email: formFields.email,
                    username: formFields.username
                });
            }

            // Hash password
            const hashedPassword = await hashPassword(password);

            // Create admin account
            const admin = await createAdminAccount(name, email, username, hashedPassword);

            console.log(`[Setup] Super admin account created successfully: ${admin.email} (ID: ${admin.id})`);

            // Return success response - let the client handle redirect
            return {
                success: true,
                message: 'Super admin account created successfully',
                admin: {
                    id: admin.id,
                    name: admin.name,
                    email: admin.email,
                    username: admin.username
                }
            };

        } catch (error) {
            // Re-throw redirect responses (they're not errors)
            if (error instanceof Response) {
                throw error;
            }

            console.error('[Setup] Unexpected error:', error instanceof Error ? error.message : error);

            return fail(500, {
                errorMsg: 'An unexpected error occurred. Please try again.',
                name: formFields.name,
                email: formFields.email,
                username: formFields.username
            });
        }
    }
};