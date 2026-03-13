import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/schema.js';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Pool tuning: increased max connections for dashboard queries, avoid long waits when DB is unreachable
  max: parseInt(env.DB_POOL_MAX || '20', 10), // Increased from 10 to 20
  idleTimeoutMillis: parseInt(env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMillis: parseInt(env.DB_CONN_TIMEOUT_MS || '10000', 10), // Increased timeout from 5s to 10s
});

export const db = drizzle(pool, { schema });
