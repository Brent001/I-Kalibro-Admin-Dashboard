import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { isSessionRevoked, refreshAccessToken } from '$lib/server/db/auth.js';

const JWT_SECRET             = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const IS_PRODUCTION          = process.env.NODE_ENV === 'production';
const ACCESS_TOKEN_MAX_AGE_S = 15 * 60;

const RESERVATION_OPEN_STATUSES = ['pending', 'approved'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransactionRecord {
    id: number;
    status: string;
    recordKind?: 'borrowing' | 'reservation';
    daysOverdue?: number;
    hoursOverdue?: number;
    [key: string]: unknown;
}

export interface InitialFilters {
    tab:        string;
    itemType:   string;
    period:     string;
    customDays: string;
    search:     string;
    highlight:  number | null;
}

export interface TransactionStats {
    total:    number;
    borrowed: number;
    returned: number;
    overdue:  number;
    reserved: number;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function clearAuthCookies(cookies: Parameters<PageServerLoad>[0]['cookies']) {
    cookies.delete('token',         { path: '/' });
    cookies.delete('refresh_token', { path: '/' });
}

async function resolveToken(
    cookies: Parameters<PageServerLoad>[0]['cookies']
): Promise<{ token: string; decoded: any } | null> {
    const token = cookies.get('token');
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return { token, decoded };
    } catch (err) {
        if (!(err instanceof jwt.TokenExpiredError)) return null;
    }

    const refreshToken = cookies.get('refresh_token');
    if (!refreshToken) return null;

    try {
        const refreshed = await refreshAccessToken(refreshToken);
        if (!refreshed?.accessToken) return null;

        cookies.set('token', refreshed.accessToken, {
            path:     '/',
            httpOnly: true,
            secure:   IS_PRODUCTION,
            sameSite: IS_PRODUCTION ? 'strict' : 'lax',
            maxAge:   ACCESS_TOKEN_MAX_AGE_S,
        });

        const decoded = jwt.verify(refreshed.accessToken, JWT_SECRET);
        return { token: refreshed.accessToken, decoded };
    } catch {
        return null;
    }
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

function parseFilters(url: URL): InitialFilters {
    return {
        tab:        url.searchParams.get('tab')    || 'all',
        itemType:   url.searchParams.get('type')   || 'all',
        period:     url.searchParams.get('period') || 'all',
        customDays: url.searchParams.get('days')   || '',
        search:     url.searchParams.get('q')      || '',
        highlight:  url.searchParams.has('highlight')
            ? Number(url.searchParams.get('highlight'))
            : null,
    };
}

function computeStats(transactions: TransactionRecord[]): TransactionStats {
    return {
        total:    transactions.length,
        borrowed: transactions.filter(t => t.status?.toLowerCase() === 'borrowed').length,
        returned: transactions.filter(t => t.status?.toLowerCase() === 'fulfilled').length,
        overdue:  transactions.filter(t =>
            Number(t.daysOverdue  || 0) > 0 ||
            Number(t.hoursOverdue || 0) > 0
        ).length,
        reserved: transactions.filter(t =>
            t.recordKind === 'reservation' &&
            RESERVATION_OPEN_STATUSES.includes(t.status?.toLowerCase() ?? '')
        ).length,
    };
}

async function fetchInitialTransactions(
    fetchFn: typeof fetch,
    origin:  string,
    filters: InitialFilters
): Promise<{ transactions: TransactionRecord[]; total: number; fineSettings: unknown }> {
    const apiUrl = new URL('/api/transactions', origin);
    apiUrl.searchParams.set('page',  '1');
    apiUrl.searchParams.set('limit', '20');

    // Only send non-default values — passing tab:'all' intentionally omits the param
    if (filters.search)                                    apiUrl.searchParams.set('search',     filters.search);
    if (filters.tab      && filters.tab      !== 'all')    apiUrl.searchParams.set('tab',        filters.tab);
    if (filters.period   && filters.period   !== 'all')    apiUrl.searchParams.set('period',     filters.period);
    if (filters.customDays)                                apiUrl.searchParams.set('customDays', filters.customDays);
    if (filters.itemType && filters.itemType !== 'all')    apiUrl.searchParams.set('itemType',   filters.itemType);

    try {
        const res = await fetchFn(apiUrl.toString());
        if (!res.ok) {
            console.warn('[transactions] API responded', res.status);
            return { transactions: [], total: 0, fineSettings: null };
        }
        const json = await res.json();
        return {
            transactions: json.transactions ?? [],
            total:        json.total        ?? 0,
            fineSettings: json.fineSettings ?? null,
        };
    } catch (err) {
        console.error('[transactions] fetchInitialTransactions failed:', err);
        return { transactions: [], total: 0, fineSettings: null };
    }
}

// ─── Page load ────────────────────────────────────────────────────────────────

export const load: PageServerLoad = async ({ cookies, url, fetch }) => {

    // ── 1. Resolve a valid token (with silent refresh) ────────────────────────
    const resolved = await resolveToken(cookies);
    if (!resolved) {
        clearAuthCookies(cookies);
        throw redirect(302, '/');
    }

    const { token, decoded } = resolved;

    // ── 2. Revocation check ───────────────────────────────────────────────────
    try {
        if (await isSessionRevoked(token)) {
            console.warn('[transactions] Session revoked');
            clearAuthCookies(cookies);
            throw redirect(302, '/');
        }
    } catch (err) {
        if (err instanceof Response || (err as any)?.status) throw err;
        console.warn('[transactions] isSessionRevoked check failed (non-fatal):', (err as any)?.message);
    }

    // ── 3. Extract user identity ──────────────────────────────────────────────
    const userId = decoded.userId || decoded.id;
    if (!userId) {
        console.warn('[transactions] Token missing user ID');
        clearAuthCookies(cookies);
        throw redirect(302, '/');
    }

    // ── 4. Parse URL filter params ────────────────────────────────────────────
    const initialFilters = parseFilters(url);

    // ── 5. Parallel fetch: tab-filtered table data + tab-agnostic stats ───────
    //
    // When the user lands on a non-"all" tab (e.g. ?tab=fulfilled), the table
    // fetch only returns fulfilled records, which would make the stat cards
    // show wrong counts. We fix this by fetching stats without the tab filter
    // in parallel — zero extra latency compared to sequential fetches.
    //
    // When tab === 'all', both fetches would be identical, so we skip the
    // second one and reuse the table result for stats.
    const needsSeparateStats = initialFilters.tab !== 'all';

    const [tableResult, statsResult] = await Promise.all([
        fetchInitialTransactions(fetch, url.origin, initialFilters),
        needsSeparateStats
            // Strip the tab filter so the API returns all statuses
            ? fetchInitialTransactions(fetch, url.origin, { ...initialFilters, tab: 'all' })
            : Promise.resolve(null),
    ]);

    const { transactions, total, fineSettings } = tableResult;

    // If we're on "all", table data already covers stats; otherwise use the
    // dedicated tab-agnostic fetch.
    const statsTransactions = statsResult ? statsResult.transactions : transactions;
    const stats = computeStats(statsTransactions);

    // ── 6. Return everything the client needs ─────────────────────────────────
    return {
        user: {
            id:          userId,
            username:    decoded.username,
            email:       decoded.email,
            userType:    decoded.userType,
            permissions: decoded.permissions,
        },
        initialFilters,
        transactions,       // tab-filtered, feeds the table
        statsTransactions,  // tab-agnostic, feeds the stat cards
        totalCount: total,
        fineSettings,
        stats,              // pre-computed from statsTransactions
    };
};