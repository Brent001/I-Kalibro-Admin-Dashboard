/**
 * Type definitions for the new database schema
 * Based on the comprehensive schema migration
 */

// ============================================
// USER & ROLE TYPES
// ============================================

export type StaffRole = 'super_admin' | 'admin' | 'staff';
export type UserType = 'student' | 'faculty';
export type ActorType = 'super_admin' | 'admin' | 'staff' | 'user';

export interface AuthenticatedUser {
    id: number;
    uniqueId: string;
    username: string;
    email: string;
    name: string;
    role?: StaffRole; // For staff/admin/super_admin
    userType?: UserType; // For library users
    isActive: boolean;
    sessionId: string;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================
// ITEM TYPES
// ============================================

export type ItemType = 'book' | 'magazine' | 'research' | 'multimedia';
export type ItemStatus = 'available' | 'borrowed' | 'reserved' | 'maintenance' | 'lost' | 'damaged' | 'archived';
export type ItemCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';

export interface LibraryItem {
    id: number;
    itemType: ItemType;
    title: string;
    totalCopies: number;
    availableCopies: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ItemCopy {
    id: number;
    copyNumber: string;
    qrCode: string;
    condition: ItemCondition;
    status: ItemStatus;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================
// TRANSACTION TYPES
// ============================================

export type TransactionType = 'book' | 'magazine' | 'research' | 'multimedia';
export type TransactionStatus = 'borrowed' | 'returned' | 'overdue';

export interface Transaction {
    id: number;
    userId: number;
    itemType: TransactionType;
    borrowDate: Date;
    dueDate: Date;
    returnDate?: Date;
    status: TransactionStatus;
    approvedBy?: number;
    createdAt: Date;
    updatedAt: Date;
}

// ============================================
// FINE & PAYMENT TYPES
// ============================================

export type FineStatus = 'unpaid' | 'paid' | 'waived';
export type PaymentMethod = 'cash' | 'card' | 'online';

export interface Fine {
    id: number;
    userId: number;
    fineAmount: number;
    daysOverdue: number;
    status: FineStatus;
    createdAt: Date;
}

export interface Payment {
    id: number;
    transactionId: string;
    userId: number;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate: Date;
    createdAt: Date;
}

// ============================================
// PERMISSION TYPES
// ============================================

export interface StaffPermissions {
    id: number;
    staffUniqueId: string;
    canManageBooks: boolean;
    canManageUsers: boolean;
    canManageBorrowing: boolean;
    canManageReservations: boolean;
    canViewReports: boolean;
    canManageFines: boolean;
    customPermissions: unknown[];
    createdAt: Date;
    updatedAt: Date;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
    errors?: Array<{ field: string; message: string }>;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
}
