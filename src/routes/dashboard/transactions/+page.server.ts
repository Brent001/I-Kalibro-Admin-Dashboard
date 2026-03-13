import type { PageServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { isSessionRevoked, refreshAccessToken } from '$lib/server/db/auth.js';

const JWT_SECRET       = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const IS_PRODUCTION    = process.env.NODE_ENV === 'production';
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
    tab:         string;
    itemType:    string;
    period:      string;
    customDays:  string;
    search:      string;
    highlight:   number | null;
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

/**
 * Resolve a valid, non-expired access token.
 *
 * 1. Try the existing token cookie.
 * 2. If expired, silently refresh using the refresh_token cookie.
 * 3. On successful refresh, write a new token cookie and return the decoded payload.
 * 4. On any other failure, return null so the caller can redirect.
 */
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
        // Fall through to silent refresh
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

/** Build the initial filter state from incoming URL search params. */
function parseFilters(url: URL): InitialFilters {
    return {
        tab:        url.searchParams.get('tab')       || 'all',
        itemType:   url.searchParams.get('type')      || 'all',
        period:     url.searchParams.get('period')    || 'all',
        customDays: url.searchParams.get('days')      || '',
        search:     url.searchParams.get('q')         || '',
        highlight:  url.searchParams.has('highlight')
            ? Number(url.searchParams.get('highlight'))
            : null,
    };
}

/** Compute summary stats from a flat transaction array. */
function computeStats(transactions: TransactionRecord[]): TransactionStats {
    return {
        total:    transactions.length,
        borrowed: transactions.filter(t => t.status?.toLowerCase() === 'borrowed').length,
        returned: transactions.filter(t => t.status?.toLowerCase() === 'returned').length,
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

/** Fetch the first page of transactions from the internal API. */
async function fetchInitialTransactions(
    fetchFn: typeof fetch,
    origin:  string,
    filters: InitialFilters
): Promise<{ transactions: TransactionRecord[]; total: number; fineSettings: unknown }> {
    const apiUrl = new URL('/api/transactions', origin);
    apiUrl.searchParams.set('page',  '1');
    apiUrl.searchParams.set('limit', '500');

    if (filters.search)                     apiUrl.searchParams.set('search',     filters.search);
    if (filters.tab       && filters.tab       !== 'all') apiUrl.searchParams.set('tab',        filters.tab);
    if (filters.period    && filters.period    !== 'all') apiUrl.searchParams.set('period',     filters.period);
    if (filters.customDays)                 apiUrl.searchParams.set('customDays', filters.customDays);
    if (filters.itemType  && filters.itemType  !== 'all') apiUrl.searchParams.set('itemType',   filters.itemType);

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
        // Re-throw SvelteKit redirects; swallow everything else (best-effort check)
        if (err instanceof Response || (err as any)?.status) throw err;
        console.warn('[transactions] isSessionRevoked check failed (non-fatal):', (err as any)?.message);
    }

    // ── 3. Extract user identity from verified token ──────────────────────────
    const userId = decoded.userId || decoded.id;
    if (!userId) {
        console.warn('[transactions] Token missing user ID');
        clearAuthCookies(cookies);
        throw redirect(302, '/');
    }

    // ── 4. Parse URL filter params (determines initial UI state + API query) ──
    const initialFilters = parseFilters(url);

    // ── 5. Fetch initial transactions server-side ─────────────────────────────
    const { transactions, total, fineSettings } = await fetchInitialTransactions(
        fetch,
        url.origin,
        initialFilters
    );

    // ── 6. Pre-compute stats so the client renders instantly ──────────────────
    const stats = computeStats(transactions);

    return {
        user: {
            id:          userId,
            username:    decoded.username,
            email:       decoded.email,
            userType:    decoded.userType,
            permissions: decoded.permissions,
        },
        // Filter state (mirrors what the client will read from the URL)
        initialFilters,
        // Pre-fetched data — client skips its own initial fetch
        transactions,
        totalCount: total,
        fineSettings,
        // Pre-computed stats — avoids a client-side pass on first render
        stats,
    };
};