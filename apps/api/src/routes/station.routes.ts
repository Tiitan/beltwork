import type { FastifyInstance } from 'fastify'
import { resolveAuth } from '../services/auth.service.js'
import { getStationSnapshotForPlayer } from '../services/station.service.js'
import type { AppServices } from '../types/api.js'

export function registerStationRoutes(app: FastifyInstance, services: AppServices): void {
  async function handleStation(request: any, reply: any) {
    const auth = await resolveAuth(services, request)
    if (!auth) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const snapshot = await getStationSnapshotForPlayer(services, auth.playerId)
    if (!snapshot) {
      return reply.code(404).send({ error: 'station_not_found' })
    }

    return snapshot
  }

  app.get('/v1/station', handleStation)
}
