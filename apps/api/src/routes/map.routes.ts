import type { FastifyInstance } from 'fastify'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { resolveAuth } from '../services/auth.service.js'
import { asteroid, scannedAsteroids } from '../db/schema.js'
import { getMapSnapshotForPlayer } from '../services/map.service.js'
import type { AppServices } from '../types/api.js'

export function registerMapRoutes(app: FastifyInstance, services: AppServices): void {
  async function handleMap(request: any, reply: any) {
    const auth = await resolveAuth(services, request)
    if (!auth) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const snapshot = await getMapSnapshotForPlayer(services, auth.playerId)
    return snapshot
  }

  async function handleScanAsteroid(request: any, reply: any) {
    const auth = await resolveAuth(services, request)
    if (!auth) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_payload', details: params.error.issues })
    }

    const [asteroidRow] = await services.db
      .select({
        id: asteroid.id,
        remainingUnits: asteroid.remainingUnits,
      })
      .from(asteroid)
      .where(and(eq(asteroid.id, params.data.id), eq(asteroid.isDepleted, false)))
      .limit(1)

    if (!asteroidRow) {
      return reply.code(404).send({ error: 'asteroid_not_found' })
    }

    const [scanRow] = await services.db
      .insert(scannedAsteroids)
      .values({
        playerId: auth.playerId,
        asteroidId: asteroidRow.id,
        remainingUnits: asteroidRow.remainingUnits,
      })
      .onConflictDoUpdate({
        target: [scannedAsteroids.playerId, scannedAsteroids.asteroidId],
        set: {
          remainingUnits: asteroidRow.remainingUnits,
          scannedAt: sql`now()`,
          updatedAt: sql`now()`,
        },
      })
      .returning({
        asteroidId: scannedAsteroids.asteroidId,
        remainingUnits: scannedAsteroids.remainingUnits,
        scannedAt: scannedAsteroids.scannedAt,
      })

    return {
      scanned: true,
      asteroid_id: scanRow.asteroidId,
      remaining_units: scanRow.remainingUnits,
      scanned_at: scanRow.scannedAt.toISOString(),
    }
  }

  app.get('/v1/map', handleMap)
  app.post('/v1/asteroids/:id/scan', handleScanAsteroid)
}
