import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db, pool } from '../db/client.js'
import { asteroid, miningOperations, scannedAsteroids } from '../db/schema.js'
import { loadMiningDockRigConfig } from '../services/mining-config.service.js'
import { processDueDomainEventsOnce } from '../services/domain-events.service.js'
import { IMMEDIATE_OUTBOUND_RECALL_WINDOW_MS } from '../services/mining.service.js'
import { buildServer, buildServerWithServices } from '../server.js'
import { clearTestDatabase } from '../test/testDatabase.js'

function getSessionCookiePair(setCookieHeader: string | string[] | undefined): string {
  const rawCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader
  if (!rawCookie) {
    throw new Error('missing set-cookie header')
  }

  const [cookiePair] = rawCookie.split(';')
  if (!cookiePair) {
    throw new Error('invalid set-cookie header')
  }

  return cookiePair
}

describe('mining routes', () => {
  it('requires authentication for starting operation', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/mining/operations',
      payload: {
        asteroid_id: '00000000-0000-0000-0000-000000000000',
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'unauthorized' })
  })

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'starts mining operation and enqueues arrival event',
    async () => {
      await clearTestDatabase()

      const app = buildServer({
        checkReadiness: async () => {},
      })

      const startNowResponse = await app.inject({
        method: 'POST',
        url: '/v1/session/start-now',
      })
      const cookiePair = getSessionCookiePair(startNowResponse.headers['set-cookie'])
      const bootstrapResponse = await app.inject({
        method: 'GET',
        url: '/v1/session/bootstrap',
        headers: {
          cookie: cookiePair,
        },
      })
      const playerId = bootstrapResponse.json().profile.id as string

      const stationResponse = await app.inject({
        method: 'GET',
        url: '/v1/station',
        headers: { cookie: cookiePair },
      })
      const stationId = stationResponse.json().id as string

      const buildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: { cookie: cookiePair },
        payload: {
          building_type: 'mining_docks',
          slot_index: 1,
        },
      })
      expect(buildResponse.statusCode).toBe(200)

      const [targetAsteroid] = await db
        .insert(asteroid)
        .values({
          templateId: 'common_chondrite',
          x: 50,
          y: 80,
          remainingUnits: 900,
          seed: 'mining-seed-1',
          isDepleted: false,
        })
        .returning({ id: asteroid.id })

      await db.insert(scannedAsteroids).values({
        playerId,
        asteroidId: targetAsteroid.id,
        remainingUnits: 850,
      })

      const startOperationResponse = await app.inject({
        method: 'POST',
        url: '/v1/mining/operations',
        headers: { cookie: cookiePair },
        payload: {
          asteroid_id: targetAsteroid.id,
        },
      })

      expect(startOperationResponse.statusCode).toBe(200)
      const payload = startOperationResponse.json()
      expect(payload.mining_rig_capacity).toBeGreaterThanOrEqual(1)
      expect(payload.active_mining_operations).toHaveLength(1)
      expect(payload.active_mining_operations[0]).toMatchObject({
        asteroid_id: targetAsteroid.id,
        status: 'flying_to_destination',
        return_origin_progress: null,
        quantity: 0,
      })

      const eventsResult = await pool.query(
        'select event_type from domain_events where station_id = $1 and event_type = $2',
        [stationId, 'station.mining.rig.arrived.v1'],
      )
      expect(eventsResult.rows).toHaveLength(1)
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'recalls outbound operation within 10s and completes immediately with no queued return event',
    async () => {
      await clearTestDatabase()

      const app = buildServer({
        checkReadiness: async () => {},
      })

      const startNowResponse = await app.inject({
        method: 'POST',
        url: '/v1/session/start-now',
      })
      const cookiePair = getSessionCookiePair(startNowResponse.headers['set-cookie'])
      const bootstrapResponse = await app.inject({
        method: 'GET',
        url: '/v1/session/bootstrap',
        headers: {
          cookie: cookiePair,
        },
      })
      const playerId = bootstrapResponse.json().profile.id as string

      const buildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: { cookie: cookiePair },
        payload: {
          building_type: 'mining_docks',
          slot_index: 1,
        },
      })
      expect(buildResponse.statusCode).toBe(200)

      const [targetAsteroid] = await db
        .insert(asteroid)
        .values({
          templateId: 'common_chondrite',
          x: 120,
          y: 140,
          remainingUnits: 600,
          seed: 'mining-seed-2',
          isDepleted: false,
        })
        .returning({ id: asteroid.id })

      await db.insert(scannedAsteroids).values({
        playerId,
        asteroidId: targetAsteroid.id,
        remainingUnits: 555,
      })

      const startOperationResponse = await app.inject({
        method: 'POST',
        url: '/v1/mining/operations',
        headers: { cookie: cookiePair },
        payload: {
          asteroid_id: targetAsteroid.id,
        },
      })
      expect(startOperationResponse.statusCode).toBe(200)
      const operationId = startOperationResponse.json().active_mining_operations[0].id as string
      const operationPhaseStartedAt = startOperationResponse.json().active_mining_operations[0]
        .phase_started_at as string

      const boundaryNow = new Date(
        Date.parse(operationPhaseStartedAt) + IMMEDIATE_OUTBOUND_RECALL_WINDOW_MS,
      )
      const RealDate = Date
      class MockDate extends RealDate {
        constructor(...args: ConstructorParameters<typeof Date>) {
          if (args.length === 0) {
            super(boundaryNow.getTime())
            return
          }

          super(...args)
        }

        static now(): number {
          return boundaryNow.getTime()
        }
      }

      const recallResponse = await (async () => {
        globalThis.Date = MockDate as unknown as DateConstructor
        try {
          return await app.inject({
            method: 'PATCH',
            url: `/v1/mining/operations/${operationId}`,
            headers: { cookie: cookiePair },
            payload: {
              action: 'recall',
            },
          })
        } finally {
          globalThis.Date = RealDate
        }
      })()

      expect(recallResponse.statusCode).toBe(200)
      expect(recallResponse.json().active_mining_operations).toHaveLength(0)

      const [operationAfterRecall] = await db
        .select({
          status: miningOperations.status,
          quantity: miningOperations.quantity,
          completedAt: miningOperations.completedAt,
          dueAt: miningOperations.dueAt,
        })
        .from(miningOperations)
        .where(eq(miningOperations.id, operationId))
        .limit(1)
      expect(operationAfterRecall?.status).toBe('returning')
      expect(operationAfterRecall?.quantity).toBe(0)
      expect(operationAfterRecall?.completedAt).not.toBeNull()
      expect(operationAfterRecall?.dueAt).toBeNull()

      const [asteroidAfterRecall] = await db
        .select({
          remainingUnits: asteroid.remainingUnits,
        })
        .from(asteroid)
        .where(eq(asteroid.id, targetAsteroid.id))
        .limit(1)
      expect(asteroidAfterRecall?.remainingUnits).toBe(600)

      const [scanAfterRecall] = await db
        .select({
          remainingUnits: scannedAsteroids.remainingUnits,
        })
        .from(scannedAsteroids)
        .where(
          and(
            eq(scannedAsteroids.playerId, playerId),
            eq(scannedAsteroids.asteroidId, targetAsteroid.id),
          ),
        )
        .limit(1)
      expect(scanAfterRecall?.remainingUnits).toBe(555)

      const returnEvents = await pool.query(
        `select count(*)::integer as count
         from domain_events
         where event_type = 'station.mining.rig.returned.v1'
           and payload_json->>'operation_id' = $1`,
        [operationId],
      )
      expect(returnEvents.rows[0]?.count).toBe(0)

      const arrivalEvents = await pool.query(
        `select count(*)::integer as count
         from domain_events
         where event_type = 'station.mining.rig.arrived.v1'
           and payload_json->>'operation_id' = $1`,
        [operationId],
      )
      expect(arrivalEvents.rows[0]?.count).toBe(0)

      const restartResponse = await app.inject({
        method: 'POST',
        url: '/v1/mining/operations',
        headers: { cookie: cookiePair },
        payload: {
          asteroid_id: targetAsteroid.id,
        },
      })
      expect(restartResponse.statusCode).toBe(200)
      expect(restartResponse.json().active_mining_operations).toHaveLength(1)
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'recalls outbound operation after 10s and schedules return from elapsed outbound time',
    async () => {
      await clearTestDatabase()

      const app = buildServer({
        checkReadiness: async () => {},
      })

      const startNowResponse = await app.inject({
        method: 'POST',
        url: '/v1/session/start-now',
      })
      const cookiePair = getSessionCookiePair(startNowResponse.headers['set-cookie'])

      const buildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: { cookie: cookiePair },
        payload: {
          building_type: 'mining_docks',
          slot_index: 1,
        },
      })
      expect(buildResponse.statusCode).toBe(200)

      const [targetAsteroid] = await db
        .insert(asteroid)
        .values({
          templateId: 'common_chondrite',
          x: 220,
          y: 260,
          remainingUnits: 900,
          seed: 'mining-seed-5',
          isDepleted: false,
        })
        .returning({ id: asteroid.id })

      const startOperationResponse = await app.inject({
        method: 'POST',
        url: '/v1/mining/operations',
        headers: { cookie: cookiePair },
        payload: {
          asteroid_id: targetAsteroid.id,
        },
      })
      expect(startOperationResponse.statusCode).toBe(200)
      const operationId = startOperationResponse.json().active_mining_operations[0].id as string

      const now = Date.now()
      const forcedPhaseStartedAt = new Date(now - IMMEDIATE_OUTBOUND_RECALL_WINDOW_MS - 5_000)
      const forcedPhaseFinishAt = new Date(now + 30_000)
      await db
        .update(miningOperations)
        .set({
          phaseStartedAt: forcedPhaseStartedAt,
          phaseFinishAt: forcedPhaseFinishAt,
          dueAt: forcedPhaseFinishAt,
        })
        .where(eq(miningOperations.id, operationId))

      const expectedElapsedMsBeforeRecall = Date.now() - forcedPhaseStartedAt.getTime()
      const recallResponse = await app.inject({
        method: 'PATCH',
        url: `/v1/mining/operations/${operationId}`,
        headers: { cookie: cookiePair },
        payload: {
          action: 'recall',
        },
      })

      expect(recallResponse.statusCode).toBe(200)
      expect(recallResponse.json().active_mining_operations[0]).toMatchObject({
        id: operationId,
        status: 'returning',
        quantity: 0,
      })
      expect(
        recallResponse.json().active_mining_operations[0].return_origin_progress,
      ).toBeGreaterThan(0)
      expect(recallResponse.json().active_mining_operations[0].return_origin_progress).toBeLessThan(
        1,
      )

      const [operationAfterRecall] = await db
        .select({
          status: miningOperations.status,
          phaseStartedAt: miningOperations.phaseStartedAt,
          phaseFinishAt: miningOperations.phaseFinishAt,
          completedAt: miningOperations.completedAt,
        })
        .from(miningOperations)
        .where(eq(miningOperations.id, operationId))
        .limit(1)

      expect(operationAfterRecall?.status).toBe('returning')
      expect(operationAfterRecall?.completedAt).toBeNull()
      expect(operationAfterRecall?.phaseFinishAt).not.toBeNull()

      const scheduledReturnDurationMs =
        (operationAfterRecall?.phaseFinishAt?.getTime() ?? 0) -
        (operationAfterRecall?.phaseStartedAt?.getTime() ?? 0)
      expect(scheduledReturnDurationMs).toBeGreaterThanOrEqual(
        Math.max(0, expectedElapsedMsBeforeRecall - 250),
      )
      expect(scheduledReturnDurationMs).toBeLessThanOrEqual(expectedElapsedMsBeforeRecall + 1_500)

      const returnEvents = await pool.query(
        `select count(*)::integer as count
         from domain_events
         where event_type = 'station.mining.rig.returned.v1'
           and payload_json->>'operation_id' = $1`,
        [operationId],
      )
      expect(returnEvents.rows[0]?.count).toBe(1)
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'recall during mining decrements asteroid and updates scanned snapshot',
    async () => {
      await clearTestDatabase()

      const { app, services } = buildServerWithServices({
        checkReadiness: async () => {},
      })

      const startNowResponse = await app.inject({
        method: 'POST',
        url: '/v1/session/start-now',
      })
      const cookiePair = getSessionCookiePair(startNowResponse.headers['set-cookie'])
      const bootstrapResponse = await app.inject({
        method: 'GET',
        url: '/v1/session/bootstrap',
        headers: { cookie: cookiePair },
      })
      const playerId = bootstrapResponse.json().profile.id as string

      const stationResponse = await app.inject({
        method: 'GET',
        url: '/v1/station',
        headers: { cookie: cookiePair },
      })
      const stationX = stationResponse.json().x as number
      const stationY = stationResponse.json().y as number

      const buildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: { cookie: cookiePair },
        payload: {
          building_type: 'mining_docks',
          slot_index: 1,
        },
      })
      expect(buildResponse.statusCode).toBe(200)

      const [targetAsteroid] = await db
        .insert(asteroid)
        .values({
          templateId: 'common_chondrite',
          x: stationX,
          y: stationY,
          remainingUnits: 700,
          seed: 'mining-seed-4',
          isDepleted: false,
        })
        .returning({ id: asteroid.id })

      const startOperationResponse = await app.inject({
        method: 'POST',
        url: '/v1/mining/operations',
        headers: { cookie: cookiePair },
        payload: {
          asteroid_id: targetAsteroid.id,
        },
      })
      expect(startOperationResponse.statusCode).toBe(200)
      const operationId = startOperationResponse.json().active_mining_operations[0].id as string

      const futureNow = new Date(Date.now() + 600_000)
      await processDueDomainEventsOnce(services, futureNow)

      const [miningOperationRow] = await db
        .select({
          status: miningOperations.status,
          quantityTarget: miningOperations.quantityTarget,
        })
        .from(miningOperations)
        .where(eq(miningOperations.id, operationId))
        .limit(1)

      expect(miningOperationRow?.status).toBe('mining')

      const rigConfig = await loadMiningDockRigConfig()
      const oneUnitElapsedMs = Math.max(1, Math.ceil(60_000 / rigConfig.miningSpeedUnitsPerMin) + 5)
      const forcedPhaseStartedAt = new Date(Date.now() - oneUnitElapsedMs)
      await db
        .update(miningOperations)
        .set({
          phaseStartedAt: forcedPhaseStartedAt,
        })
        .where(eq(miningOperations.id, operationId))

      const recallResponse = await app.inject({
        method: 'PATCH',
        url: `/v1/mining/operations/${operationId}`,
        headers: { cookie: cookiePair },
        payload: {
          action: 'recall',
        },
      })
      expect(recallResponse.statusCode).toBe(200)
      expect(recallResponse.json().active_mining_operations[0]?.return_origin_progress).toBe(1)

      const [operationAfterRecall] = await db
        .select({
          status: miningOperations.status,
          quantity: miningOperations.quantity,
          quantityTarget: miningOperations.quantityTarget,
        })
        .from(miningOperations)
        .where(eq(miningOperations.id, operationId))
        .limit(1)
      expect(operationAfterRecall?.status).toBe('returning')
      expect(operationAfterRecall?.quantity).toBeGreaterThan(0)
      expect(operationAfterRecall?.quantity).toBeLessThanOrEqual(
        operationAfterRecall?.quantityTarget ?? 0,
      )

      const [asteroidAfterRecall] = await db
        .select({
          remainingUnits: asteroid.remainingUnits,
        })
        .from(asteroid)
        .where(eq(asteroid.id, targetAsteroid.id))
        .limit(1)
      const [scanAfterRecall] = await db
        .select({
          remainingUnits: scannedAsteroids.remainingUnits,
        })
        .from(scannedAsteroids)
        .where(
          and(
            eq(scannedAsteroids.playerId, playerId),
            eq(scannedAsteroids.asteroidId, targetAsteroid.id),
          ),
        )
        .limit(1)

      expect(asteroidAfterRecall?.remainingUnits).toBe(700 - (operationAfterRecall?.quantity ?? 0))
      expect(scanAfterRecall?.remainingUnits).toBe(asteroidAfterRecall?.remainingUnits)
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'finalizes mining operation quantity using min(cargo, remaining) and decrements asteroid units',
    async () => {
      await clearTestDatabase()

      const { app, services } = buildServerWithServices({
        checkReadiness: async () => {},
      })

      const startNowResponse = await app.inject({
        method: 'POST',
        url: '/v1/session/start-now',
      })
      const cookiePair = getSessionCookiePair(startNowResponse.headers['set-cookie'])
      const bootstrapResponse = await app.inject({
        method: 'GET',
        url: '/v1/session/bootstrap',
        headers: { cookie: cookiePair },
      })
      const playerId = bootstrapResponse.json().profile.id as string

      const stationResponse = await app.inject({
        method: 'GET',
        url: '/v1/station',
        headers: { cookie: cookiePair },
      })
      const stationId = stationResponse.json().id as string
      const stationX = stationResponse.json().x as number
      const stationY = stationResponse.json().y as number

      const buildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: { cookie: cookiePair },
        payload: {
          building_type: 'mining_docks',
          slot_index: 1,
        },
      })
      expect(buildResponse.statusCode).toBe(200)

      const [targetAsteroid] = await db
        .insert(asteroid)
        .values({
          templateId: 'common_chondrite',
          x: stationX,
          y: stationY,
          remainingUnits: 300,
          seed: 'mining-seed-3',
          isDepleted: false,
        })
        .returning({ id: asteroid.id })

      const startOperationResponse = await app.inject({
        method: 'POST',
        url: '/v1/mining/operations',
        headers: { cookie: cookiePair },
        payload: {
          asteroid_id: targetAsteroid.id,
        },
      })
      expect(startOperationResponse.statusCode).toBe(200)
      const operationId = startOperationResponse.json().active_mining_operations[0].id as string

      const arrivalProcessingNow = new Date(Date.now() + 600_000)
      const completionProcessingNow = new Date(arrivalProcessingNow.getTime() + 600_000)
      const returnProcessingNow = new Date(completionProcessingNow.getTime() + 60_000)
      await processDueDomainEventsOnce(services, arrivalProcessingNow)
      await processDueDomainEventsOnce(services, completionProcessingNow)
      await processDueDomainEventsOnce(services, returnProcessingNow)

      const [operationRow] = await db
        .select({
          quantity: miningOperations.quantity,
          quantityTarget: miningOperations.quantityTarget,
          completedAt: miningOperations.completedAt,
        })
        .from(miningOperations)
        .where(and(eq(miningOperations.id, operationId), eq(miningOperations.stationId, stationId)))
        .limit(1)

      expect(operationRow?.quantity).toBe(300)
      expect(operationRow?.quantityTarget).toBe(300)
      expect(operationRow?.completedAt).not.toBeNull()

      const [asteroidAfterMining] = await db
        .select({
          remainingUnits: asteroid.remainingUnits,
        })
        .from(asteroid)
        .where(eq(asteroid.id, targetAsteroid.id))
        .limit(1)
      expect(asteroidAfterMining?.remainingUnits).toBe(0)

      const [scanAfterMining] = await db
        .select({
          remainingUnits: scannedAsteroids.remainingUnits,
        })
        .from(scannedAsteroids)
        .where(
          and(
            eq(scannedAsteroids.playerId, playerId),
            eq(scannedAsteroids.asteroidId, targetAsteroid.id),
          ),
        )
        .limit(1)
      expect(scanAfterMining?.remainingUnits).toBe(0)

      const eventsResult = await pool.query('select count(*)::integer as count from domain_events')
      expect(eventsResult.rows[0]?.count).toBe(0)
    },
  )
})
