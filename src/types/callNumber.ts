/**
 * TypeScript type definitions for the Call Number Generation System
 */

/**
 * Request object for call number generation
 */
export interface CallNumberGenerationRequest {
	/** Author's last name (required) */
	authorLastName: string;

	/** Book category (optional, used to determine Dewey Decimal) */
	category?: string;

	/** Custom Dewey Decimal number (optional, overrides category-based DDC) */
	customDDC?: string;

	/** Copy number (optional, defaults to '1') */
	copyNumber?: string;

	/** Custom call number to use instead of generating (optional) */
	customCallNumber?: string;
}

/**
 * Response from call number generation API/function
 */
export interface CallNumberGenerationResponse {
	/** Whether the operation was successful */
	success: boolean;

	/** Generated call number (e.g., "823.92 S123") */
	callNumber?: string;

	/** Generated book ID (e.g., "823.92S123-1") */
	bookId?: string;

	/** Dewey Decimal portion of the call number */
	ddc?: string;

	/** Cutter number portion of the call number */
	cutter?: string;

	/** Error message if operation failed */
	error?: string;
}

/**
 * Parsed call number components
 */
export interface ParsedCallNumber {
	/** Dewey Decimal Classification number */
	ddc: string;

	/** Cutter number */
	cutter: string;
}

/**
 * Call number validation result
 */
export interface CallNumberValidation {
	/** Whether the call number format is valid */
	valid: boolean;

	/** Validation message (error or success) */
	message: string;

	/** Dewey Decimal portion (if valid) */
	ddc?: string;

	/** Cutter number portion (if valid) */
	cutter?: string;
}

/**
 * Book with call number information
 */
export interface BookWithCallNumber {
	// Basic book info
	id?: number;
	title: string;
	author: string;
	isbn?: string;
	publisher?: string;
	publishedYear?: number;

	// Call number info
	bookId: string; // Generated unique ID (823.92S123-1)
	location: string; // Call number (823.92 S123)
	ddc?: string; // Dewey Decimal (823.92)
	cutter?: string; // Cutter number (S123)
	copyNumber?: string; // Copy identifier (1, 2, 3, etc.)

	// Category info
	category?: string;
	categoryId?: number;

	// Timestamps
	createdAt?: Date;
	updatedAt?: Date;
}

/**
 * Category information with Dewey Decimal mapping
 */
export interface CategoryInfo {
	/** Category identifier (used as key in system) */
	category: string;

	/** Dewey Decimal Classification number */
	deweyDecimal: string;

	/** Human-readable category name */
	displayName: string;

	/** Description of the category */
	description?: string;
}

/**
 * Batch generate request for multiple books
 */
export interface BatchCallNumberRequest {
	/** List of call number generation requests */
	requests: CallNumberGenerationRequest[];

	/** Whether to stop on first error */
	stopOnError?: boolean;
}

/**
 * Batch generation result
 */
export interface BatchCallNumberResult {
	/** Overall success status */
	success: boolean;

	/** Results for each request */
	results: CallNumberGenerationResponse[];

	/** Summary statistics */
	summary: {
		total: number;
		successful: number;
		failed: number;
	};

	/** Error message if batch operation failed */
	error?: string;
}

/**
 * Cutter number generation options
 */
export interface CutterGenerationOptions {
	/** Use custom Cutter-Sanborn table (if false, uses simplified version) */
	useFullTable?: boolean;

	/** Include numeric suffix (if true, e.g., "S123"; if false, e.g., "S") */
	includeNumeric?: boolean;

	/** Maximum length of Cutter number */
	maxLength?: number;
}

/**
 * Call number formatting options
 */
export interface CallNumberFormatOptions {
	/** Include spacing between DDC and Cutter */
	includeSpace?: boolean;

	/** Maximum decimal places for DDC (0 for integer only) */
	ddc_decimalPlaces?: number;

	/** Uppercase Cutter letter */
	cutterUppercase?: boolean;
}

/**
 * Call number range for filtering/searching
 */
export interface CallNumberRange {
	/** Starting Dewey Decimal number */
	startDDC: string;

	/** Ending Dewey Decimal number */
	endDDC: string;

	/** Optional Cutter range start */
	startCutter?: string;

	/** Optional Cutter range end */
	endCutter?: string;
}

/**
 * Call number statistics
 */
export interface CallNumberStatistics {
	/** Total number of books processed */
	totalBooks: number;

	/** Number of unique Dewey Decimals */
	uniqueDDCs: number;

	/** Number of unique Cutters */
	uniqueCutters: number;

	/** Most common Dewey Decimal */
	mostCommonDDC?: string;

	/** Least common Dewey Decimal */
	leastCommonDDC?: string;

	/** DDC distribution statistics */
	ddcDistribution?: Record<string, number>;

	/** Cutter distribution (first letter) */
	cutterDistribution?: Record<string, number>;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	message?: string;
	error?: string;
	timestamp?: Date;
}

/**
 * Paginated response for batch operations
 */
export interface PaginatedCallNumberResponse {
	success: boolean;
	data: CallNumberGenerationResponse[];
	pagination: {
		page: number;
		pageSize: number;
		total: number;
		hasMore: boolean;
	};
}

/**
 * Call number migration job
 */
export interface CallNumberMigrationJob {
	/** Job ID */
	id: string;

	/** Status of the migration */
	status: 'pending' | 'in-progress' | 'completed' | 'failed';

	/** Total items to process */
	totalItems: number;

	/** Items processed so far */
	processedItems: number;

	/** Items successfully processed */
	successItems: number;

	/** Items failed */
	failedItems: number;

	/** Progress percentage */
	progress: number;

	/** Start time */
	startTime?: Date;

	/** End time */
	endTime?: Date;

	/** Error message if failed */
	error?: string;
}

/**
 * Call number lookup result
 */
export interface CallNumberLookupResult {
	/** The call number(s) found */
	callNumbers: string[];

	/** Related books information */
	books?: BookWithCallNumber[];

	/** Number of results */
	count: number;

	/** Whether there are more results */
	hasMore: boolean;
}

/**
 * Cutter-Sanborn table entry
 */
export interface CutterSanbornEntry {
	/** Letter combination (e.g., "A", "AB", "ABC") */
	combination: string;

	/** Four-figure Cutter number (e.g., "2", "3", "32") */
	cutter: string;

	/** Description or range */
	description?: string;
}

/**
 * Dewey Decimal metadata
 */
export interface DeweyDecimalInfo {
	/** The DDC number */
	number: string;

	/** Full class name */
	className: string;

	/** Parent class number */
	parentClass?: string;

	/** Related classes */
	relatedClasses?: string[];

	/** Category mapping */
	categories?: string[];

	/** Scope note/description */
	scopeNote?: string;
}

/**
 * Book copy with call number
 */
export interface BookCopyWithCallNumber {
	id: number;
	bookId: number;
	copyNumber: string;
	qrCode: string;
	barcode?: string;
	condition: string;
	status: string;
	callNumber?: string; // Call number for display
	fullCallNumber?: string; // Full call number with copy number
	acquisitionDate?: Date;
	notes?: string;
}

/**
 * Validation error detail
 */
export interface ValidationError {
	field: string;
	message: string;
	value?: any;
}

/**
 * Extended call number with metadata
 */
export interface CallNumberWithMetadata extends ParsedCallNumber {
	/** Full formatted call number */
	full: string;

	/** Shortened version */
	short?: string;

	/** Copy number component */
	copyNumber?: string;

	/** Generated timestamp */
	generatedAt?: Date;

	/** Whether this is a custom/manual call number */
	isCustom?: boolean;

	/** Validation status */
	isValid?: boolean;

	/** Quality score (0-100) */
	qualityScore?: number;
}
