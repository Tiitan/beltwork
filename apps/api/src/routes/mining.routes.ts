import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveAuth } from '../services/auth.service.js'
import {
  MiningOperationError,
  recallMiningOperationForPlayer,
  startMiningOperationForPlayer,
} from '../services/mining.service.js'
import type { AppServices } from '../types/api.js'

export function registerMiningRoutes(app: FastifyInstance, services: AppServices): void {
  async function handleStartMiningOperation(request: any, reply: any) {
    const auth = await resolveAuth(services, request)
    if (!auth) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const body = z
      .object({
        asteroid_id: z.string().uuid(),
      })
      .safeParse(request.body)

    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: body.error.issues,
      })
    }

    try {
      return await startMiningOperationForPlayer(services, auth.playerId, {
        asteroidId: body.data.asteroid_id,
      })
    } catch (error) {
      if (!(error instanceof MiningOperationError)) {
        throw error
      }

      if (error.code === 'station_not_found' || error.code === 'asteroid_not_found') {
        return reply.code(404).send({ error: error.code })
      }

      return reply.code(409).send({ error: error.code })
    }
  }

  async function handleRecallMiningOperation(request: any, reply: any) {
    const auth = await resolveAuth(services, request)
    if (!auth) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const params = z
      .object({
        operationId: z.string().uuid(),
      })
      .safeParse(request.params)
    const body = z
      .object({
        action: z.literal('recall'),
      })
      .safeParse(request.body)

    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: [
          ...(params.success ? [] : params.error.issues),
          ...(body.success ? [] : body.error.issues),
        ],
      })
    }

    try {
      return await recallMiningOperationForPlayer(services, auth.playerId, {
        operationId: params.data.operationId,
      })
    } catch (error) {
      if (!(error instanceof MiningOperationError)) {
        throw error
      }

      if (
        error.code === 'station_not_found' ||
        error.code === 'asteroid_not_found' ||
        error.code === 'operation_not_found'
      ) {
        return reply.code(404).send({ error: error.code })
      }

      return reply.code(409).send({ error: error.code })
    }
  }

  app.post('/v1/mining/operations', handleStartMiningOperation)
  app.patch('/v1/mining/operations/:operationId', handleRecallMiningOperation)
}
