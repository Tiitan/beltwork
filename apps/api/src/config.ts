import { config } from 'dotenv'
import { z } from 'zod'

config()

/**
 * Environment schema for API process configuration.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/beltwork'),
  SESSION_COOKIE_SECRET: z.string().default('dev-change-me-session-secret'),
  SESSION_COOKIE_NAME: z.string().default('beltwork_session'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_ALLOWED_ISSUERS: z.string().default('accounts.google.com,https://accounts.google.com'),
})

/**
 * Parsed and validated environment configuration.
 */
export const env = envSchema.parse(process.env)
