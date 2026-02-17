import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

config()

/**
 * Drizzle Kit migration and schema generation configuration.
 */
export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/beltwork',
  },
})
