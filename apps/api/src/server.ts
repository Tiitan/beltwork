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
import { registerMiningRoutes } from './routes/mining.routes.js'
import { registerJournalRoutes } from './routes/journal.routes.js'
import { buildGameDomainEventHandlerRegistry } from './services/domain-events/game-domain-event-registry.js'

/**
 * Creates and configures the Fastify API instance.
 *
 * @param options Optional dependency overrides, mainly used by tests.
 * @returns Configured Fastify server instance.
 */
function createAppServices(options: BuildServerOptions = {}): AppServices {
  return {
    db,
    env,
    checkReadiness: options.checkReadiness ?? checkDatabaseConnection,
    verifyGoogleIdToken: options.verifyGoogleIdToken ?? createDefaultVerifyGoogleIdToken(env),
    factoryJobs: new Map(),
    domainEventHandlers: buildGameDomainEventHandlerRegistry(),
  }
}

export function buildServerWithServices(options: BuildServerOptions = {}) {
  const services = createAppServices(options)

  const app = Fastify({
    logger: true,
  })

  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })

  registerHealthRoutes(app, services)
  registerAuthRoutes(app, services)
  registerStationRoutes(app, services)
  registerJournalRoutes(app, services)
  registerMapRoutes(app, services)
  registerMiningRoutes(app, services)
  registerFactoryRoutes(app, services)

  return {
    app,
    services,
  }
}

export function buildServer(options: BuildServerOptions = {}) {
  const { app } = buildServerWithServices(options)
  return app
}
