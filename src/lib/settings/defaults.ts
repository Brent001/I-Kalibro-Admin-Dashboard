export const DEFAULT_FINE_CALCULATION = {
	excludeSundays: true,
	excludeCampusClosedDays: false,
	closedWeekdays: [0],
	holidays: [] as { date: string; description: string; type: 'holiday' | 'closed' }[]
};

export const DEFAULT_SYSTEM_SETTINGS = {
	bulkAddEnabled: false,
	libraryName: 'Metro Dagupan Colleges Library',
	libraryCode: 'MDC-LIB',
	address: 'National Highway, Barangay Salay, Mangaldan, 2432 Pangasinan',
	phone: '+63 75 522 4567',
	email: 'library@mdc.edu.ph',
	website: 'https://mdc.edu.ph/library',
	visitScanMethod: 'qrcode' as 'qrcode' | 'barcode',
	defaultLoanPeriodStudent: 7,
	defaultLoanPeriodFaculty: 14,
	maxBooksPerStudent: 3,
	maxBooksPerFaculty: 5,
	maxMagazinesPerUser: 2,
	maxThesesPerUser: 1,
	maxJournalsPerUser: 2,
	maxRenewals: 1,
	reservationExpiryDays: 3,
	reservationApprovalWindowHours: 48,
	overdueFinePerDay: 5.00,
	maxFineAmount: 500.00,
	damageFinePct: 50,
	lostFineMultiplier: 100,
	fineWaiverThreshold: 10.00,
	gracePeriodDays: 0,
	allowUserReturnRequests: true,
	returnRequestWindowDays: 30,
	autoMarkOverdueDays: 1,
	notifDueReminder: true,
	notifOverdue: true,
	notifReservationReady: true,
	notifReturnConfirmation: true,
	notifDueReminderDaysBefore: 2,
	notifChannelEmail: true,
	sessionTimeoutMinutes: 30,
	passwordExpiryDays: 90,
	maxLoginAttempts: 3,
	twoFactorAuth: false,
	backupFrequency: 'daily',
	fineCalculation: DEFAULT_FINE_CALCULATION
};

export const DEFAULT_STAFF_PERMISSIONS = {
	canManageBooks: true,
	canManageUsers: false,
	canManageBorrowing: true,
	canManageReservations: true,
	canViewReports: false,
	canManageFines: true
};

export const DEFAULT_NOTIFICATION_SETTINGS = {
	notifDueReminder: true,
	notifOverdue: true,
	notifReservationReady: true,
	notifReturnConfirmation: true,
	notifDueReminderDaysBefore: 2,
	notifChannelEmail: true
};