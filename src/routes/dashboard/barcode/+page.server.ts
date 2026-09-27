import type { PageServerLoad } from './$types.js';
import { authenticateUser, isStaffOrHigher } from '$lib/server/services/authService.js';
import { getStaffInfo, getRecentVisits, calculateScanStats, formatVisitResponse } from '$lib/server/services/barcodeService.js';

/**
 * Load page data - recent scans and statistics
 */
export const load: PageServerLoad = async ({ request }) => {
    const user = await authenticateUser(request);

    // Check authorization - only super_admin, admin, and staff can access
    if (!user || !isStaffOrHigher(user)) {
        return {
            authorized: false,
            hardwareSupport: false,
            recentScans: [],
            stats: {
                totalScans: 0,
                studentsScanned: 0,
                facultyScanned: 0
            }
        };
    }

    try {
        // Get staff info and recent visits in parallel
        const [staffInfo, recentVisits] = await Promise.all([
            getStaffInfo(user.id),
            getRecentVisits(20)
        ]);

        // Calculate statistics
        const stats = calculateScanStats(recentVisits);

        // Format recent scans for display
        const formattedScans = recentVisits.map(formatVisitResponse);

        return {
            authorized: true,
            staffName: staffInfo?.name || 'Staff Member',
            staffDepartment: staffInfo?.department || '',
            staffPosition: staffInfo?.position || '',
            recentScans: formattedScans,
            stats,
            // indicate server supports hardware scanner POST actions
            hardwareSupport: true
        };
    } catch (err) {
        console.error('Error loading barcode scanner page:', err);
        return {
            authorized: true,
            staffName: 'Staff Member',
            recentScans: [],
            stats: {
                totalScans: 0,
                studentsScanned: 0,
                facultyScanned: 0
            }
            ,
            hardwareSupport: true
        };
    }
};

// Server-side action to support hardware barcode scanners that POST the barcode
export const actions = {
    scan: async ({ request }) => {
        try {
            // Support hardware scanners sending POSTs without session cookies
            const HARDWARE_KEY = process.env.BARCODE_HARDWARE_KEY || process.env.BARCODE_HARDWARE_TOKEN || '';
            const hwKeyHeader = request.headers.get('x-hardware-key') || request.headers.get('x-api-key') || '';

            // Try normal user auth first
            const user = await authenticateUser(request);
            const isHardware = HARDWARE_KEY && hwKeyHeader && HARDWARE_KEY === hwKeyHeader;

            if (!user && !isHardware) {
                return { success: false, error: 'Unauthorized' };
            }

            const form = await request.formData();
            const rawBarcode = form.get('barcode');
            const barcode = typeof rawBarcode === 'string' ? rawBarcode.trim() : (rawBarcode ? String(rawBarcode).trim() : '');
            const action = (form.get('action') as string) || 'time_in';
            const purpose = (form.get('purpose') as string) || 'Library Access';

            if (!barcode) {
                return { success: false, error: 'Missing barcode' };
            }

            // Forward the scan to the internal API endpoint so the same validation
            // and DB logic is used (preserves a single source of truth).
            const apiUrl = new URL('/api/barcode/scan-member', request.url).toString();
            // Forward hardware key header when request originates from scanner device
            const forwardHeaders: Record<string, string> = {
                'content-type': 'application/json'
            };

            const cookieHeader = request.headers.get('cookie');
            if (cookieHeader) {
                forwardHeaders.cookie = cookieHeader;
            }

            if (isHardware) {
                forwardHeaders['x-hardware-key'] = hwKeyHeader;
            }

            const apiResp = await fetch(apiUrl, {
                method: 'POST',
                headers: forwardHeaders,
                body: JSON.stringify({ barcode, action, purpose })
            });

            const jsonResult = await apiResp.json();
            return { success: apiResp.ok, result: jsonResult };
        } catch (err) {
            console.error('scan action error:', err);
            return { success: false, error: 'Error processing scan' };
        }
    }
};