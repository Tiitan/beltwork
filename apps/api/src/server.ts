import Fastify from 'fastify'
import cors from '@fastify/cors'
import { z } from 'zod'
import { checkDatabaseConnection } from './db/client.js'
import {
  catchUpFactoryJob,
  catchUpInputSchema,
  clearRecipe,
  createSelectedJob,
  selectRecipeInputSchema,
  toFactoryJobReadModel,
  type FactoryJob,
} from './factory-jobs/service.js'

type BuildServerOptions = {
  checkReadiness?: () => Promise<void>
}

export function buildServer(options: BuildServerOptions = {}) {
  const checkReadiness = options.checkReadiness ?? checkDatabaseConnection
  const factoryJobs = new Map<string, FactoryJob>()

  const app = Fastify({
    logger: true,
  })

  app.register(cors, {
    origin: true,
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

  app.get('/live', async () => {
    return { status: 'ok' }
  })

  app.post('/auth/login', async () => {
    return {
      ok: true,
      message: 'Draft login endpoint',
    }
  })

  app.post('/v1/factories/:id/select-recipe', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const body = selectRecipeInputSchema.safeParse(request.body)

    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: [
          ...(params.success ? [] : params.error.issues),
          ...(body.success ? [] : body.error.issues),
        ],
      })
    }

    const now = new Date()
    const job = createSelectedJob(params.data.id, body.data, now)
    factoryJobs.set(params.data.id, job)

    return {
      job: toFactoryJobReadModel(job),
      events: [
        {
          event_type: 'factory.recipe.selected',
          payload: {
            factory_id: job.factoryId,
            recipe_key: job.recipeKey,
            target_cycles: job.targetCycles,
          },
        },
      ],
    }
  })

  app.post('/v1/factories/:id/catch-up', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const body = catchUpInputSchema.safeParse(request.body)

    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: [
          ...(params.success ? [] : params.error.issues),
          ...(body.success ? [] : body.error.issues),
        ],
      })
    }

    const existing = factoryJobs.get(params.data.id)
    if (!existing) {
      return reply.code(404).send({ error: 'factory_job_not_found' })
    }

    const next = catchUpFactoryJob(existing, body.data)
    factoryJobs.set(params.data.id, next)

    const events: Array<{ event_type: string; payload: Record<string, unknown> }> = []
    const producedCycles = next.cyclesCompleted - existing.cyclesCompleted

    if (producedCycles > 0) {
      events.push({
        event_type: 'inventory.changed',
        payload: {
          factory_id: next.factoryId,
          produced_cycles: producedCycles,
        },
      })
    }

    if (next.completedAt !== null && existing.completedAt === null && next.targetCycles !== null) {
      events.push({
        event_type: 'factory.production.completed',
        payload: {
          factory_id: next.factoryId,
          completed_cycles: next.cyclesCompleted,
          target_cycles: next.targetCycles,
        },
      })
    }

    return { job: toFactoryJobReadModel(next), events }
  })

  app.post('/v1/factories/:id/clear-recipe', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_payload', details: params.error.issues })
    }

    const existing = factoryJobs.get(params.data.id)
    if (!existing) {
      return reply.code(404).send({ error: 'factory_job_not_found' })
    }

    const next = clearRecipe(existing, new Date())
    factoryJobs.set(params.data.id, next)

    return { job: toFactoryJobReadModel(next) }
  })

  app.get('/v1/factories/:id', async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_payload', details: params.error.issues })
    }

    const existing = factoryJobs.get(params.data.id)
    if (!existing) {
      return reply.code(404).send({ error: 'factory_job_not_found' })
    }

    return { job: toFactoryJobReadModel(existing) }
  })

  return app
}
