import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from '../config.js'

/**
 * Shared PostgreSQL connection pool.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
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
