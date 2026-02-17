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

/**
 * Optional server dependency overrides for tests and local harnesses.
 */
type BuildServerOptions = {
  checkReadiness?: () => Promise<void>
}

/**
 * Creates and configures the Fastify API instance.
 *
 * @param options Optional dependency overrides, mainly used by tests.
 * @returns Configured Fastify server instance.
 */
export function buildServer(options: BuildServerOptions = {}) {
  /**
   * Readiness checker dependency used by the readiness endpoint.
   */
  const checkReadiness = options.checkReadiness ?? checkDatabaseConnection
  /**
   * In-memory factory job state keyed by factory id.
   */
  const factoryJobs = new Map<string, FactoryJob>()

  const app = Fastify({
    logger: true,
  })

  app.register(cors, {
    origin: true,
  })

  /**
   * Handles readiness checks by validating downstream dependencies.
   *
   * @returns Readiness status payload.
   */
  async function handleReady(_: unknown, reply: any) {
    try {
      await checkReadiness()
      return { status: 'ready' }
    } catch (error) {
      app.log.error({ error }, 'readiness check failed')
      return reply.code(503).send({ status: 'not_ready' })
    }
  }

  /**
   * Handles liveness checks for process health.
   *
   * @returns Liveness status payload.
   */
  async function handleLive() {
    return { status: 'ok' }
  }

  /**
   * Temporary login endpoint for frontend integration.
   *
   * @returns Draft login response payload.
   */
  async function handleLogin() {
    return {
      ok: true,
      message: 'Draft login endpoint',
    }
  }

  /**
   * Selects a recipe for a factory and starts a corresponding production job.
   *
   * @returns Job read model and emitted domain events.
   */
  async function handleSelectRecipe(request: any, reply: any) {
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
  }

  /**
   * Advances an existing factory job based on elapsed time and capacities.
   *
   * @returns Updated job read model and resulting events.
   */
  async function handleCatchUp(request: any, reply: any) {
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
  }

  /**
   * Clears the selected recipe from an existing factory job.
   *
   * @returns Updated job read model.
   */
  async function handleClearRecipe(request: any, reply: any) {
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
  }

  /**
   * Fetches the current state for a specific factory job.
   *
   * @returns Factory job read model.
   */
  async function handleGetFactory(request: any, reply: any) {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_payload', details: params.error.issues })
    }

    const existing = factoryJobs.get(params.data.id)
    if (!existing) {
      return reply.code(404).send({ error: 'factory_job_not_found' })
    }

    return { job: toFactoryJobReadModel(existing) }
  }

  app.get('/ready', handleReady)
  app.get('/live', handleLive)
  app.post('/auth/login', handleLogin)
  app.post('/v1/factories/:id/select-recipe', handleSelectRecipe)
  app.post('/v1/factories/:id/catch-up', handleCatchUp)
  app.post('/v1/factories/:id/clear-recipe', handleClearRecipe)
  app.get('/v1/factories/:id', handleGetFactory)

  return app
}
