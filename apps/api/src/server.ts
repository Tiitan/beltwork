import Fastify from 'fastify'
import cors from '@fastify/cors'
import { env } from './config.js'
import { db, checkDatabaseConnection } from './db/client.js'
import type { AppServices, BuildServerOptions } from './types/api.js'
import { createDefaultVerifyGoogleIdToken } from './utils/google.js'
import { registerHealthRoutes } from './routes/health.routes.js'
import { registerAuthRoutes } from './routes/auth.routes.js'
import { registerStationRoutes } from './routes/station.routes.js'
import { registerFactoryRoutes } from './routes/factory.routes.js'
import { registerMapRoutes } from './routes/map.routes.js'

/**
 * Creates and configures the Fastify API instance.
 *
 * @param options Optional dependency overrides, mainly used by tests.
 * @returns Configured Fastify server instance.
 */
export function buildServer(options: BuildServerOptions = {}) {
  const services: AppServices = {
    db,
    env,
    checkReadiness: options.checkReadiness ?? checkDatabaseConnection,
    verifyGoogleIdToken: options.verifyGoogleIdToken ?? createDefaultVerifyGoogleIdToken(env),
    factoryJobs: new Map(),
  }

  const app = Fastify({
    logger: true,
  })

  app.register(cors, {
    origin: true,
    credentials: true,
  })

  registerHealthRoutes(app, services)
  registerAuthRoutes(app, services)
  registerStationRoutes(app, services)
  registerMapRoutes(app, services)
  registerFactoryRoutes(app, services)

  return app
}
