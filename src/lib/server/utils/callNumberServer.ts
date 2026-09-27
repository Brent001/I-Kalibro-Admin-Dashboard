/**
 * Server-side call number generation utilities
 * Used for API endpoints and server-side processing
 */

import {
	generateCallNumber,
	generateBookId,
	generateCutterNumber,
	getDeweyDecimal,
	parseCallNumber,
	isValidCallNumber,
} from './callNumberGenerator';

export interface CallNumberRequest {
	authorLastName: string;
	category?: string;
	customDDC?: string;
	copyNumber?: string;
	customCallNumber?: string;
}

export interface CallNumberResponse {
	success: boolean;
	callNumber?: string;
	bookId?: string;
	ddc?: string;
	cutter?: string;
	error?: string;
}

/**
 * Server-side call number generation endpoint handler
 * Can be used to generate or validate call numbers
 */
export function generateCallNumberHandler(
	request: CallNumberRequest
): CallNumberResponse {
	try {
		if (!request.authorLastName || request.authorLastName.trim().length === 0) {
			return {
				success: false,
				error: 'Author last name is required',
			};
		}

		let callNumber: string;
		let bookId: string;

		if (request.customCallNumber) {
			// Use provided custom call number
			if (!isValidCallNumber(request.customCallNumber)) {
				return {
					success: false,
					error: 'Invalid call number format. Expected: "123 A123" or "123.45 A123"',
				};
			}
			callNumber = request.customCallNumber;
		} else {
			// Generate from author and category
			callNumber = generateCallNumber(
				request.authorLastName,
				request.category || '',
				request.customDDC
			);
		}

		// Generate book ID
		bookId = generateBookId(
			request.authorLastName,
			request.category || '',
			request.copyNumber || '1',
			callNumber
		);

		// Parse call number for response
		const { ddc, cutter } = parseCallNumber(callNumber);

		return {
			success: true,
			callNumber,
			bookId,
			ddc,
			cutter,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Batch generate call numbers for multiple books
 */
export function batchGenerateCallNumbers(
	requests: CallNumberRequest[]
): CallNumberResponse[] {
	return requests.map((req) => generateCallNumberHandler(req));
}

/**
 * Validate if a call number exists and is in correct format
 */
export function validateCallNumber(callNumber: string): {
	valid: boolean;
	message: string;
	ddc?: string;
	cutter?: string;
} {
	if (!callNumber || callNumber.trim().length === 0) {
		return {
			valid: false,
			message: 'Call number cannot be empty',
		};
	}

	if (!isValidCallNumber(callNumber)) {
		return {
			valid: false,
			message:
				'Invalid call number format. Expected: "123 A123" or "123.45 A123". Example: "823.92 S123"',
		};
	}

	const { ddc, cutter } = parseCallNumber(callNumber);

	// Validate DDC is numeric with optional decimal
	if (!/^\d+(\.\d+)?$/.test(ddc)) {
		return {
			valid: false,
			message: 'Invalid Dewey Decimal format. Expected digits with optional decimal point.',
		};
	}

	// Validate Cutter is letter followed by digits
	if (!/^[A-Z]\d+$/.test(cutter)) {
		return {
			valid: false,
			message: 'Invalid Cutter format. Expected uppercase letter followed by digits.',
		};
	}

	return {
		valid: true,
		message: 'Call number is valid',
		ddc,
		cutter,
	};
}

/**
 * Get suggested call numbers based on similar books
 * This would typically query the database for quick suggestions
 */
export function getSuggestedCallNumbers(
	authorLastName: string,
	category: string,
	limit: number = 5
): string[] {
	const baseCutter = generateCutterNumber(authorLastName);
	const baseDDC = getDeweyDecimal(category);

	// Generate variations for suggestions
	const suggestions: string[] = [];

	// Add base call number
	suggestions.push(`${baseDDC} ${baseCutter}`);

	// Add variations with different DDC decimal places
	const ddcParts = baseDDC.split('.');
	if (ddcParts.length > 1) {
		suggestions.push(`${ddcParts[0]} ${baseCutter}`);
		suggestions.push(`${baseDDC.substring(0, baseDDC.indexOf('.'))} ${baseCutter}`);
	}

	return suggestions.slice(0, limit);
}
