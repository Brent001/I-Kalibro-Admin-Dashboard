/**
 * API endpoint for generating call numbers for journals
 * Endpoint: /api/journals/generate-call-number
 * Method: POST
 * 
 * Supports:
 * - Serial/journal support with volume/issue
 * - Publication years
 * - Multiple copies
 * - Enhanced journal IDs
 * - Proper shelf ordering
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	generateCallNumber,
	isValidCallNumber,
	type BookMetadata,
	type GeneratedCallNumber,
} from '$lib/utils/callNumberGenerator.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Request interface
interface CallNumberRequest {
	// Required
	authorLastName?: string;
	
	// Optional - Journal details
	title?: string;
	category?: string;
	customDDC?: string;
	issn?: string;
	
	// Optional - Publication info
	year?: number;
	publisher?: string;
	
	// Optional - Serial/Periodical info (important for journals)
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
		journalId: string;         // Unique identifier
		shelfOrder: string;        // For database sorting
		components: {              // Individual components
			ddc: string;
			cutter: string;
			year?: string;
			volume?: string;
			issue?: string;
			copy?: string;
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

	// For journals, volume/issue are typically required
	if (!body.isSerial && !body.volume && !body.issue) {
		// If not explicitly marked as serial, volume/issue are optional
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
 * POST handler - Generate call number for journal
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

			return json({
				success: true,
				data: {
					callNumber: body.customCallNumber,
					journalId: 'custom-' + Date.now(),
					shelfOrder: body.customCallNumber.replace(/\s+/g, '-'),
					components: {
						ddc: body.customCallNumber,
						cutter: '',
					},
					display: {
						full: body.customCallNumber,
						compact: body.customCallNumber,
						label: body.customCallNumber,
					},
				},
			} as CallNumberResponse);
		}

		// Prepare metadata for call number generation
		const metadata: BookMetadata = {
			title: body.title || 'Journal',
			authorLastName: body.authorLastName || '',
			category: body.category,
			customDDC: body.customDDC,
			year: body.year,
			edition: body.issue ? `Issue ${body.issue}` : undefined,
			copy: body.copy,
		};

		// Generate call number
		const result = generateCallNumber(metadata);

		// Format displays
		const displays = formatDisplays(result);

		// Build unique journal ID
		const journalId = `J-${body.title ? body.title.substring(0, 3).toUpperCase() : 'UNK'}-${body.volume || '000'}-${body.issue || '00'}-${Date.now()}`;

		return json({
			success: true,
			data: {
				callNumber: result.full,
				journalId: result.bookId,
				shelfOrder: result.shelfOrder,
				components: {
					ddc: result.components.ddc || '',
					cutter: result.components.cutter || '',
					year: body.year?.toString(),
					volume: body.volume?.toString(),
					issue: body.issue?.toString(),
					copy: body.copy?.toString(),
				},
				display: displays,
			},
		} as CallNumberResponse);
	} catch (err: any) {
		console.error('Error generating call number:', err);
		return json(
			{
				success: false,
				error: 'Internal server error: ' + (err?.message || 'Unknown error'),
			} as CallNumberResponse,
			{ status: 500 }
		);
	}
};
