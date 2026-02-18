import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  catchUpFactoryJob,
  catchUpInputSchema,
  clearRecipe,
  createSelectedJob,
  selectRecipeInputSchema,
  toFactoryJobReadModel,
} from '../factory-jobs/service.js'
import type { AppServices } from '../types/api.js'

export function registerFactoryRoutes(app: FastifyInstance, services: AppServices): void {
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
    services.factoryJobs.set(params.data.id, job)

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

    const existing = services.factoryJobs.get(params.data.id)
    if (!existing) {
      return reply.code(404).send({ error: 'factory_job_not_found' })
    }

    const next = catchUpFactoryJob(existing, body.data)
    services.factoryJobs.set(params.data.id, next)

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

  async function handleClearRecipe(request: any, reply: any) {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_payload', details: params.error.issues })
    }

    const existing = services.factoryJobs.get(params.data.id)
    if (!existing) {
      return reply.code(404).send({ error: 'factory_job_not_found' })
    }

    const next = clearRecipe(existing, new Date())
    services.factoryJobs.set(params.data.id, next)

    return { job: toFactoryJobReadModel(next) }
  }

  async function handleGetFactory(request: any, reply: any) {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_payload', details: params.error.issues })
    }

    const existing = services.factoryJobs.get(params.data.id)
    if (!existing) {
      return reply.code(404).send({ error: 'factory_job_not_found' })
    }

    return { job: toFactoryJobReadModel(existing) }
  }

  app.post('/v1/factories/:id/select-recipe', handleSelectRecipe)
  app.post('/v1/factories/:id/catch-up', handleCatchUp)
  app.post('/v1/factories/:id/clear-recipe', handleClearRecipe)
  app.get('/v1/factories/:id', handleGetFactory)
}
