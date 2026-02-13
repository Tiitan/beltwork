import Fastify from 'fastify'
import cors from '@fastify/cors'
import { checkDatabaseConnection } from './db/client.js'

type BuildServerOptions = {
  checkReadiness?: () => Promise<void>
}

export function buildServer(options: BuildServerOptions = {}) {
  const checkReadiness = options.checkReadiness ?? checkDatabaseConnection

  const app = Fastify({
    logger: true,
  })

  app.register(cors, {
    origin: true,
  })

  app.get('/live', async () => {
    return { status: 'ok' }
  })

  app.get('/ready', async (_, reply) => {
    try {
      await checkReadiness()
      return { status: 'ready' }
    } catch (error) {
      app.log.error({ error }, 'readiness check failed')
      return reply.code(503).send({ status: 'not_ready' })
    }
  })

  app.get('/health', async () => {
    return { status: 'ok' }
  })

  app.post('/auth/login', async () => {
    return {
      ok: true,
      message: 'Draft login endpoint',
    }
  })

  return app
}
