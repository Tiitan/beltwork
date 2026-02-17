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
})

/**
 * Parsed and validated environment configuration.
 */
export const env = envSchema.parse(process.env)
