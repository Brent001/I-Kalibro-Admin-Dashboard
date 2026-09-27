// lib/server/cache/index.ts
import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';

// Upstash Redis configuration
export const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
});

const REDIS_RETRY_DELAY_MS = 30_000;
let redisUnavailableUntil = 0;
let redisOutageLogged = false;

function markRedisUnavailable(reason: unknown) {
    redisUnavailableUntil = Date.now() + REDIS_RETRY_DELAY_MS;
    if (!redisOutageLogged) {
        redisOutageLogged = true;
        console.warn('[Redis] Cache unavailable; using database-backed fallbacks for 30 seconds.', reason instanceof Error ? reason.message : reason);
    }
}

function markRedisAvailable() {
    if (redisOutageLogged) {
        console.info('[Redis] Cache connection restored.');
    }
    redisOutageLogged = false;
    redisUnavailableUntil = 0;
}

// Helper function to check if Redis is configured
export function isRedisConfigured(): boolean {
    return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) && Date.now() >= redisUnavailableUntil;
}

/**
 * Normalise whatever Upstash returns into a plain string (or null).
 *
 * Upstash's REST client automatically deserialises JSON responses, so a value
 * that was stored as a JSON string (e.g. `JSON.stringify(session)`) comes back
 * as a parsed JavaScript object/array instead of the original string.
 * We always re-serialise it so callers receive a consistent `string | null`.
 *
 * Edge cases handled:
 *  - null / undefined  → null
 *  - already a string  → returned as-is (no double-encoding)
 *  - object / array    → JSON.stringify'd back to a string
 *  - number / boolean  → coerced to string (rare, but safe)
 */
function normaliseRedisValue(result: unknown): string | null {
    if (result === null || result === undefined) return null;
    if (typeof result === 'string') return result;
    if (typeof result === 'object') return JSON.stringify(result);
    return String(result);
}

export const redisClient = {
    async get(key: string): Promise<string | null> {
        try {
            if (!isRedisConfigured()) {
                console.warn('[Redis] Not configured – skipping GET');
                return null;
            }
            const result = await redis.get(key);
            markRedisAvailable();
            const normalised = normaliseRedisValue(result);
            console.log(`[Redis GET] key=${key} type=${typeof result} normalised=${normalised?.slice(0, 80)}`);
            return normalised;
        } catch (error) {
            markRedisUnavailable(error);
            return null;
        }
    },

    /**
     * Persist a value with no expiry.
     * Always serialises the value to a string before storing so the round-trip
     * through `get` is lossless.
     */
    async set(key: string, value: string): Promise<boolean> {
        try {
            if (!isRedisConfigured()) {
                console.warn('[Redis] Not configured – skipping SET');
                return false;
            }
            await redis.set(key, value);
            markRedisAvailable();
            console.log(`[Redis SET] key=${key}`);
            return true;
        } catch (error) {
            markRedisUnavailable(error);
            return false;
        }
    },

    /**
     * Persist a value with a TTL (seconds).
     *
     * FIX: `redis.setex()` is unreliable across Upstash SDK versions – it can
     * silently ignore the TTL or fail with a type error when the value is a
     * JSON string.  Using `redis.set(key, value, { ex: seconds })` is the
     * officially recommended approach and is consistent across all versions.
     */
    async setex(key: string, seconds: number, value: string): Promise<boolean> {
        try {
            if (!isRedisConfigured()) {
                console.warn('[Redis] Not configured – skipping SETEX');
                return false;
            }
            if (!Number.isFinite(seconds) || seconds <= 0) {
                console.warn(`[Redis SETEX] Invalid TTL ${seconds} for key=${key} – skipping`);
                return false;
            }
            // Use set() with the ex option – works correctly in all Upstash SDK versions.
            await redis.set(key, value, { ex: Math.ceil(seconds) });
            markRedisAvailable();
            console.log(`[Redis SETEX] key=${key} ttl=${Math.ceil(seconds)}s`);
            return true;
        } catch (error) {
            markRedisUnavailable(error);
            return false;
        }
    },

    async del(key: string): Promise<boolean> {
        try {
            if (!isRedisConfigured()) {
                console.warn('[Redis] Not configured – skipping DEL');
                return false;
            }
            await redis.del(key);
            markRedisAvailable();
            console.log(`[Redis DEL] key=${key}`);
            return true;
        } catch (error) {
            markRedisUnavailable(error);
            return false;
        }
    },

    /**
     * Refresh the TTL on an existing key without touching its value.
     * Useful for sliding-window session expiry without a full read-modify-write.
     */
    async expire(key: string, seconds: number): Promise<boolean> {
        try {
            if (!isRedisConfigured()) return false;
            if (!Number.isFinite(seconds) || seconds <= 0) return false;
            await redis.expire(key, Math.ceil(seconds));
            markRedisAvailable();
            return true;
        } catch (error) {
            markRedisUnavailable(error);
            return false;
        }
    },

    async sadd(key: string, member: string): Promise<boolean> {
        try {
            if (!isRedisConfigured()) return false;
            await redis.sadd(key, member);
            markRedisAvailable();
            return true;
        } catch (error) {
            markRedisUnavailable(error);
            return false;
        }
    },

    async srem(key: string, member: string): Promise<boolean> {
        try {
            if (!isRedisConfigured()) return false;
            await redis.srem(key, member);
            markRedisAvailable();
            return true;
        } catch (error) {
            markRedisUnavailable(error);
            return false;
        }
    },

    async smembers(key: string): Promise<string[]> {
        try {
            if (!isRedisConfigured()) return [];
            const members = await redis.smembers(key);
            markRedisAvailable();
            if (!Array.isArray(members)) return [];
            // Upstash may return member values as non-strings in some SDK versions.
            return members.map((m) => (typeof m === 'string' ? m : String(m)));
        } catch (error) {
            markRedisUnavailable(error);
            return [];
        }
    },

    async lpush(key: string, element: string): Promise<boolean> {
        try {
            if (!isRedisConfigured()) return false;
            await redis.lpush(key, element);
            markRedisAvailable();
            return true;
        } catch (error) {
            markRedisUnavailable(error);
            return false;
        }
    },

    async ltrim(key: string, start: number, stop: number): Promise<boolean> {
        try {
            if (!isRedisConfigured()) return false;
            await redis.ltrim(key, start, stop);
            markRedisAvailable();
            return true;
        } catch (error) {
            markRedisUnavailable(error);
            return false;
        }
    },

    async keys(pattern: string): Promise<string[]> {
        try {
            if (!isRedisConfigured()) return [];
            const keys = await redis.keys(pattern);
            markRedisAvailable();
            return Array.isArray(keys) ? keys : [];
        } catch (error) {
            markRedisUnavailable(error);
            return [];
        }
    },
};

export default redis;