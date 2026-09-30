import { drizzle } from 'drizzle-orm/node-postgres';
import { createRequire } from 'node:module';
import type { pushSchema as PushSchema } from 'drizzle-kit/api';
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

let schemaInitialization: Promise<void> | undefined;

async function pushDatabaseSchema(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [741203, 1]);

    const { pushSchema } = createRequire(import.meta.url)('drizzle-kit/api') as {
      pushSchema: typeof PushSchema;
    };
    const setupDb = drizzle(client);
    const result = await pushSchema(schema, setupDb);

    if (result.hasDataLoss) {
      throw new Error(
        result.warnings.join(' ') || 'Schema synchronization could remove existing data.'
      );
    }

    await result.apply();
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function ensureDatabaseSchema(): Promise<void> {
  if (!schemaInitialization) {
    schemaInitialization = pushDatabaseSchema().catch((error: unknown) => {
      schemaInitialization = undefined;
      throw error;
    });
  }

  return schemaInitialization;
}
