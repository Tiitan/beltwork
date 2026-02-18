import { beforeEach } from 'vitest'
import { env } from '../config.js'
import { pool } from '../db/client.js'

const testTables = [
  'player_identities',
  'sessions',
  'simulation_locks',
  'domain_events',
  'factory_jobs',
  'mining_operations',
  'asteroid',
  'station_inventory',
  'station_buildings',
  'stations',
  'players',
]

function assertUsingTestDatabase() {
  if (env.NODE_ENV !== 'test') {
    throw new Error('Test database helpers require NODE_ENV=test')
  }

  if (env.DATABASE_URL_TEST === env.DATABASE_URL) {
    throw new Error('DATABASE_URL_TEST must be different from DATABASE_URL')
  }
}

export async function clearTestDatabase() {
  assertUsingTestDatabase()
  const joinedTables = testTables.map((table) => `"${table}"`).join(', ')
  await pool.query(`TRUNCATE TABLE ${joinedTables} RESTART IDENTITY CASCADE`)
}

export function useIsolatedTestDatabase() {
  beforeEach(async () => {
    await clearTestDatabase()
  })
}
