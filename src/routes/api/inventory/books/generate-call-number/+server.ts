/**
 * Updated API endpoint for generating call numbers
 * Endpoint: /api/books/generate-call-number
 * Method: POST
 * 
 * Now supports:
 * - Full serial/journal support with volume/issue
 * - Publication years
 * - Multiple copies
 * - Enhanced book IDs
 * - Proper shelf ordering
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	generateCallNumber,
	isValidCallNumber,
	type BookMetadata,
	type GeneratedCallNumber,
} from '$lib/utils/callNumberGenerator.js'; // Your new improved system

// Request interface
interface CallNumberRequest {
	// Required
	authorLastName: string;
	
	// Optional - Book/Item details
	title?: string;
	authorFirstName?: string;
	category?: string;
	customDDC?: string;
	
	// Optional - Publication info
	year?: number;
	edition?: string;
	publisher?: string;
	
	// Optional - Serial/Periodical info
	isSerial?: boolean;
	volume?: number;
	issue?: number;
	
	// Optional - Copy management
	copy?: number;
	
	// Optional - Override
	customCallNumber?: string;
}

// Response interface
interface CallNumberResponse {
	success: boolean;
	data?: {
		callNumber: string;        // Full formatted call number
		bookId: string;            // Unique identifier
		shelfOrder: string;        // For database sorting
		components: {              // Individual components
			ddc: string;
			cutter: string;
			year?: string;
			volume?: string;
			issue?: string;
			copy?: string;
			edition?: string;
		};
		display: {
			full: string;          // Multi-line display format
			compact: string;       // Single-line format
			label: string;         // Spine label format
		};
	};
	error?: string;
	validationErrors?: {
		field: string;
		message: string;
	}[];
}

/**
 * Validate the request data
 */
function validateRequest(body: CallNumberRequest): {
	valid: boolean;
	errors: { field: string; message: string }[];
} {
	const errors: { field: string; message: string }[] = [];

	// Required field
	if (!body.authorLastName || body.authorLastName.trim().length === 0) {
		errors.push({
			field: 'authorLastName',
			message: 'Author last name is required',
		});
	}

	// Validate year if provided
	if (body.year !== undefined) {
		const currentYear = new Date().getFullYear();
		if (body.year < 1000 || body.year > currentYear + 1) {
			errors.push({
				field: 'year',
				message: `Year must be between 1000 and ${currentYear + 1}`,
			});
		}
	}

	// Validate serial fields
	if (body.isSerial) {
		if (body.volume !== undefined && (body.volume < 1 || body.volume > 9999)) {
			errors.push({
				field: 'volume',
				message: 'Volume must be between 1 and 9999',
			});
		}
		if (body.issue !== undefined && (body.issue < 1 || body.issue > 999)) {
			errors.push({
				field: 'issue',
				message: 'Issue must be between 1 and 999',
			});
		}
	}

	// Validate copy number
	if (body.copy !== undefined && (body.copy < 1 || body.copy > 99)) {
		errors.push({
			field: 'copy',
			message: 'Copy number must be between 1 and 99',
		});
	}

	// Validate custom DDC format if provided
	if (body.customDDC && !/^\d{1,3}(\.\d+)?$/.test(body.customDDC)) {
		errors.push({
			field: 'customDDC',
			message: 'Custom DDC must be in format: 123 or 123.45',
		});
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Format the generated call number for different display contexts
 */
function formatDisplays(result: GeneratedCallNumber): {
	full: string;
	compact: string;
	label: string;
} {
	// Full display (multi-line, as it appears on spine)
	const full = result.full;

	// Compact display (single line for database display)
	const compact = result.full.split('\n').join(' ');

	// Label format (optimized for small spine labels)
	const labelLines = result.full.split('\n');
	const label = labelLines.join('\n');

	return { full, compact, label };
}

/**
 * POST handler - Generate call number
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse request body
		const body: CallNumberRequest = await request.json();

		// Validate request
		const validation = validateRequest(body);
		if (!validation.valid) {
			return json(
				{
					success: false,
					error: 'Validation failed',
					validationErrors: validation.errors,
				} as CallNumberResponse,
				{ status: 400 }
			);
		}

		// If custom call number provided, validate and return it
		if (body.customCallNumber && body.customCallNumber.trim().length > 0) {
			const customValidation = isValidCallNumber(body.customCallNumber);
			
			if (!customValidation) {
				return json(
					{
						success: false,
						error: 'Invalid custom call number format. Expected format: "123 A456" or "123.45 A456"',
					} as CallNumberResponse,
					{ status: 400 }
				);
			}

			// Return custom call number with basic components
			return json({
				success: true,
				data: {
					callNumber: body.customCallNumber,
					bookId: body.customCallNumber.replace(/\s+/g, '.').replace(/\./g, '-'),
					shelfOrder: body.customCallNumber,
					components: {
						ddc: body.customCallNumber.split(/\s+/)[0] || '',
						cutter: body.customCallNumber.split(/\s+/)[1] || '',
					},
					display: {
						full: body.customCallNumber,
						compact: body.customCallNumber,
						label: body.customCallNumber,
					},
				},
			} as CallNumberResponse);
		}

		// Build metadata for call number generation
		const metadata: BookMetadata = {
			title: body.title || '',
			authorLastName: body.authorLastName.trim(),
			authorFirstName: body.authorFirstName,
			category: body.category,
			customDDC: body.customDDC,
			year: body.year,
			edition: body.edition,
			publisher: body.publisher,
			isSerial: body.isSerial || false,
			volume: body.volume,
			issue: body.issue,
			copy: body.copy,
		};

		// Generate call number using the improved system
		const result = generateCallNumber(metadata);

		// Format for different display contexts
		const displays = formatDisplays(result);

		// Return successful response
		return json({
			success: true,
			data: {
				callNumber: result.full.split('\n')[0], // First line for backward compatibility
				bookId: result.bookId,
				shelfOrder: result.shelfOrder,
				components: result.components,
				display: displays,
			},
		} as CallNumberResponse);
	} catch (error) {
		console.error('Error in call number generation API:', error);
		
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Internal server error',
			} as CallNumberResponse,
			{ status: 500 }
		);
	}
};

/**
 * GET handler - Get DDC categories
 * Returns list of all available categories
 */
export const GET: RequestHandler = async () => {
	try {
		// Import the DDC map from your improved system
		// This assumes you export it, or you can manually create a list
		const categories = [
			// 000 - Computer science
			{ value: 'computer', label: 'Computer Science', ddc: '004.2' },
			{ value: 'programming', label: 'Programming', ddc: '005.1' },
			{ value: 'ai', label: 'Artificial Intelligence', ddc: '006.3' },
			{ value: 'database', label: 'Database Systems', ddc: '005.75' },
			
			// 100 - Philosophy
			{ value: 'philosophy', label: 'Philosophy', ddc: '100' },
			{ value: 'psychology', label: 'Psychology', ddc: '150' },
			
			// 200 - Religion
			{ value: 'religion', label: 'Religion', ddc: '200' },
			
			// 300 - Social sciences
			{ value: 'economics', label: 'Economics', ddc: '330' },
			{ value: 'business', label: 'Business', ddc: '650' },
			{ value: 'business_journal', label: 'Business Journal', ddc: '650' },
			{ value: 'law', label: 'Law', ddc: '340' },
			{ value: 'education', label: 'Education', ddc: '370' },
			
			// 400 - Language
			{ value: 'language', label: 'Language', ddc: '400' },
			{ value: 'english', label: 'English', ddc: '420' },
			
			// 500 - Science
			{ value: 'science', label: 'Science', ddc: '500' },
			{ value: 'mathematics', label: 'Mathematics', ddc: '510' },
			{ value: 'physics', label: 'Physics', ddc: '530' },
			{ value: 'chemistry', label: 'Chemistry', ddc: '540' },
			{ value: 'biology', label: 'Biology', ddc: '570' },
			
			// 600 - Technology
			{ value: 'technology', label: 'Technology', ddc: '600' },
			{ value: 'medicine', label: 'Medicine', ddc: '610' },
			{ value: 'engineering', label: 'Engineering', ddc: '620' },
			{ value: 'agriculture', label: 'Agriculture', ddc: '630' },
			{ value: 'cooking', label: 'Cooking', ddc: '641.5' },
			
			// 700 - Arts
			{ value: 'arts', label: 'Arts', ddc: '700' },
			{ value: 'music', label: 'Music', ddc: '780' },
			{ value: 'sports', label: 'Sports', ddc: '796' },
			
			// 800 - Literature
			{ value: 'literature', label: 'Literature', ddc: '800' },
			{ value: 'fiction', label: 'Fiction', ddc: '823' },
			{ value: 'poetry', label: 'Poetry', ddc: '811' },
			{ value: 'drama', label: 'Drama', ddc: '812' },
			
			// 900 - History
			{ value: 'history', label: 'History', ddc: '900' },
			{ value: 'biography', label: 'Biography', ddc: '920' },
			{ value: 'geography', label: 'Geography', ddc: '910' },
			
			// Serials
			{ value: 'journal', label: 'Journal (General)', ddc: '050' },
			{ value: 'magazine', label: 'Magazine', ddc: '050' },
			{ value: 'scientific_journal', label: 'Scientific Journal', ddc: '500' },
			{ value: 'medical_journal', label: 'Medical Journal', ddc: '610' },
		];

		return json({
			success: true,
			data: {
				categories: categories.sort((a, b) => a.label.localeCompare(b.label)),
			},
		});
	} catch (error) {
		console.error('Error fetching categories:', error);
		return json(
			{
				success: false,
				error: 'Failed to fetch categories',
			},
			{ status: 500 }
		);
	}
};