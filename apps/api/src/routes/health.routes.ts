import type { FastifyInstance } from 'fastify'
import type { AppServices } from '../types/api.js'

export function registerHealthRoutes(app: FastifyInstance, services: AppServices): void {
  async function handleReady(_: unknown, reply: any) {
    try {
      await services.checkReadiness()
      return { status: 'ready' }
    } catch (error) {
      app.log.error({ error }, 'readiness check failed')
      return reply.code(503).send({ status: 'not_ready' })
    }
  }

  async function handleLive() {
    return { status: 'ok' }
  }

  app.get('/ready', handleReady)
  app.get('/live', handleLive)
}
