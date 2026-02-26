import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/schema.js';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Pool tuning: avoid long waits when DB is unreachable and limit concurrent connections
  max: parseInt(env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: parseInt(env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMillis: parseInt(env.DB_CONN_TIMEOUT_MS || '5000', 10),
});

export const db = drizzle(pool, { schema });
