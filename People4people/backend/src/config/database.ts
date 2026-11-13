import { Pool, PoolConfig } from 'pg';

const connectionString = [
  process.env.DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.INTERNAL_DATABASE_URL,
  process.env.USER_DATABASE_URL,
]
  .map((value) => value?.trim())
  .find((value): value is string => Boolean(value));

const password = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
const sslRequired = process.env.PGSSLMODE === 'require' || process.env.DB_SSL === 'true';

if (!connectionString && !password) {
  throw new Error(
    'PostgreSQL is not configured. Set DATABASE_URL to the Render PostgreSQL Internal Database URL, or set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD.',
  );
}

const poolConfig: PoolConfig = connectionString
  ? {
      connectionString,
      ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'p4p_admin',
      password,
      database: process.env.DB_NAME || 'people_for_people',
      ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    };

export const pool = new Pool(poolConfig);

pool.on('error', (error) => {
  console.error('[DATABASE POOL ERROR]', error.message);
});
