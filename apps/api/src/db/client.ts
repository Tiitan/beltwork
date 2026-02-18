import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from '../config.js'

const activeDatabaseUrl = env.NODE_ENV === 'test' ? env.DATABASE_URL_TEST : env.DATABASE_URL

if (env.NODE_ENV === 'test' && activeDatabaseUrl === env.DATABASE_URL) {
  throw new Error('DATABASE_URL_TEST must differ from DATABASE_URL when NODE_ENV is test')
}

/**
 * Shared PostgreSQL connection pool.
 */
export const pool = new Pool({
  connectionString: activeDatabaseUrl,
})

/**
 * Drizzle ORM client bound to the shared PostgreSQL pool.
 */
export const db = drizzle({ client: pool })

/**
 * Executes a minimal query to validate database connectivity.
 *
 * @returns Resolves when the query succeeds.
 */
export async function checkDatabaseConnection() {
  await pool.query('select 1')
}
