// lib/server/cache/index.ts
import { Redis } from '@upstash/redis';

// Upstash Redis configuration
export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Helper function to check if Redis is configured
export function isRedisConfigured(): boolean {
    return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// Wrapper functions with error handling for Upstash
export const redisClient = {
    async get(key: string): Promise<string | null> {
        try {
            if (!isRedisConfigured()) return null;
            return await redis.get(key);
        } catch (error) {
            console.error('Redis GET error:', error);
            return null;
        }
    },

    async set(key: string, value: string): Promise<boolean> {
        try {
            if (!isRedisConfigured()) return false;
            await redis.set(key, value);
            return true;
        } catch (error) {
            console.error('Redis SET error:', error);
            return false;
        }
    },

    async setex(key: string, seconds: number, value: string): Promise<boolean> {
        try {
            if (!isRedisConfigured()) return false;
            await redis.setex(key, seconds, value);
            return true;
        } catch (error) {
            console.error('Redis SETEX error:', error);
            return false;
        }
    },

    async del(key: string): Promise<boolean> {
        try {
            if (!isRedisConfigured()) return false;
            await redis.del(key);
            return true;
        } catch (error) {
            console.error('Redis DEL error:', error);
            return false;
        }
    },

    async sadd(key: string, member: string): Promise<boolean> {
        try {
            if (!isRedisConfigured()) return false;
            await redis.sadd(key, member);
            return true;
        } catch (error) {
            console.error('Redis SADD error:', error);
            return false;
        }
    },

    async srem(key: string, member: string): Promise<boolean> {
        try {
            if (!isRedisConfigured()) return false;
            await redis.srem(key, member);
            return true;
        } catch (error) {
            console.error('Redis SREM error:', error);
            return false;
        }
    },

    async smembers(key: string): Promise<string[]> {
        try {
            if (!isRedisConfigured()) return [];
            const members = await redis.smembers(key);
            return Array.isArray(members) ? members : [];
        } catch (error) {
            console.error('Redis SMEMBERS error:', error);
            return [];
        }
    },

    async lpush(key: string, element: string): Promise<boolean> {
        try {
            if (!isRedisConfigured()) return false;
            await redis.lpush(key, element);
            return true;
        } catch (error) {
            console.error('Redis LPUSH error:', error);
            return false;
        }
    },

    async ltrim(key: string, start: number, stop: number): Promise<boolean> {
        try {
            if (!isRedisConfigured()) return false;
            await redis.ltrim(key, start, stop);
            return true;
        } catch (error) {
            console.error('Redis LTRIM error:', error);
            return false;
        }
    },

    async keys(pattern: string): Promise<string[]> {
        try {
            if (!isRedisConfigured()) return [];
            const keys = await redis.keys(pattern);
            return Array.isArray(keys) ? keys : [];
        } catch (error) {
            console.error('Redis KEYS error:', error);
            return [];
        }
    }
};

export default redis;