import { and, eq, isNull, sql } from 'drizzle-orm'
import {
  asteroid,
  domainEvents,
  miningOperations,
  scannedAsteroids,
  stationBuildings,
  stations,
} from '../db/schema.js'
import {
  loadMiningDockRigConfig,
  minedQuantityByElapsedMs,
  miningRigCapacityForLevel,
  travelDurationMs,
} from './mining-config.service.js'
import { getStationSnapshotForPlayer } from './station.service.js'
import type { AppServices, StationSnapshotResponse } from '../types/api.js'

export const STATION_MINING_RIG_ARRIVED_EVENT_TYPE = 'station.mining.rig.arrived.v1'
export const STATION_MINING_COMPLETED_EVENT_TYPE = 'station.mining.completed.v1'
export const STATION_MINING_RIG_RETURNED_EVENT_TYPE = 'station.mining.rig.returned.v1'
export const IMMEDIATE_OUTBOUND_RECALL_WINDOW_MS = 10_000

export type MiningOperationStatus = 'flying_to_destination' | 'mining' | 'returning'

export class MiningOperationError extends Error {
  code:
    | 'station_not_found'
    | 'asteroid_not_found'
    | 'operation_not_found'
    | 'operation_not_recallable'
    | 'no_available_mining_rig'

  constructor(code: MiningOperationError['code']) {
    super(code)
    this.code = code
  }
}

type StartMiningOperationInput = {
  asteroidId: string
}

type RecallMiningOperationInput = {
  operationId: string
}

function eventIdempotencyKey(eventType: string, operationId: string, phaseStartedAtIso: string) {
  return `${eventType}:${operationId}:${phaseStartedAtIso}`
}

function distanceUnits(
  stationX: number,
  stationY: number,
  asteroidX: number,
  asteroidY: number,
): number {
  return Math.hypot(asteroidX - stationX, asteroidY - stationY)
}

async function upsertScannedAsteroidSnapshot(
  tx: any,
  input: {
    playerId: string
    asteroidId: string
    remainingUnits: number
    now: Date
  },
): Promise<void> {
  await tx
    .insert(scannedAsteroids)
    .values({
      playerId: input.playerId,
      asteroidId: input.asteroidId,
      remainingUnits: input.remainingUnits,
      scannedAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: [scannedAsteroids.playerId, scannedAsteroids.asteroidId],
      set: {
        remainingUnits: input.remainingUnits,
        scannedAt: input.now,
        updatedAt: input.now,
      },
    })
}

async function resolveMiningRigCapacity(tx: any, stationId: string): Promise<number> {
  const rigConfig = await loadMiningDockRigConfig()
  const [miningDockBuilding] = await tx
    .select({
      level: stationBuildings.level,
    })
    .from(stationBuildings)
    .where(
      and(
        eq(stationBuildings.stationId, stationId),
        eq(stationBuildings.buildingType, 'mining_docks'),
      ),
    )
    .limit(1)

  if (!miningDockBuilding) {
    return 0
  }

  return miningRigCapacityForLevel(miningDockBuilding.level, rigConfig)
}

export async function startMiningOperationForPlayer(
  services: AppServices,
  playerId: string,
  input: StartMiningOperationInput,
): Promise<StationSnapshotResponse> {
  const now = new Date()
  const rigConfig = await loadMiningDockRigConfig()

  await services.db.transaction(async (tx) => {
    const [stationRow] = await tx
      .select({
        id: stations.id,
        x: stations.x,
        y: stations.y,
      })
      .from(stations)
      .where(eq(stations.playerId, playerId))
      .limit(1)

    if (!stationRow) {
      throw new MiningOperationError('station_not_found')
    }

    await tx.execute(sql`select id from stations where id = ${stationRow.id} for update`)

    const capacity = await resolveMiningRigCapacity(tx, stationRow.id)
    if (capacity <= 0) {
      throw new MiningOperationError('no_available_mining_rig')
    }

    const [activeOps] = await tx
      .select({
        count: sql<number>`count(*)::integer`,
      })
      .from(miningOperations)
      .where(
        and(eq(miningOperations.stationId, stationRow.id), isNull(miningOperations.completedAt)),
      )
      .limit(1)

    if ((activeOps?.count ?? 0) >= capacity) {
      throw new MiningOperationError('no_available_mining_rig')
    }

    const [asteroidRow] = await tx
      .select({
        id: asteroid.id,
        x: asteroid.x,
        y: asteroid.y,
      })
      .from(asteroid)
      .where(and(eq(asteroid.id, input.asteroidId), eq(asteroid.isDepleted, false)))
      .limit(1)

    if (!asteroidRow) {
      throw new MiningOperationError('asteroid_not_found')
    }

    const [scanRow] = await tx
      .select({
        remainingUnits: scannedAsteroids.remainingUnits,
      })
      .from(scannedAsteroids)
      .where(
        and(
          eq(scannedAsteroids.playerId, playerId),
          eq(scannedAsteroids.asteroidId, asteroidRow.id),
        ),
      )
      .limit(1)

    const outboundDurationMs = travelDurationMs(
      distanceUnits(stationRow.x, stationRow.y, asteroidRow.x, asteroidRow.y),
      rigConfig.moveSpeedUnitsPerMin,
    )
    const phaseFinishAt = new Date(now.getTime() + outboundDurationMs)

    const [createdOperation] = await tx
      .insert(miningOperations)
      .values({
        stationId: stationRow.id,
        asteroidId: asteroidRow.id,
        status: 'flying_to_destination',
        startedAt: now,
        phaseStartedAt: now,
        phaseFinishAt,
        dueAt: phaseFinishAt,
        cargoCapacity: rigConfig.cargoUnits,
        quantity: 0,
        quantityTarget: 0,
        estimatedAsteroidRemainingUnits: scanRow?.remainingUnits ?? null,
        asteroidRemainingUnitsAtMiningStart: null,
      })
      .returning({
        id: miningOperations.id,
        phaseStartedAt: miningOperations.phaseStartedAt,
      })

    if (!createdOperation) {
      throw new Error('failed_to_create_mining_operation')
    }

    const phaseStartedAtIso = createdOperation.phaseStartedAt.toISOString()
    await tx.insert(domainEvents).values({
      stationId: stationRow.id,
      eventType: STATION_MINING_RIG_ARRIVED_EVENT_TYPE,
      payloadJson: {
        operation_id: createdOperation.id,
        phase_started_at: phaseStartedAtIso,
      },
      idempotencyKey: eventIdempotencyKey(
        STATION_MINING_RIG_ARRIVED_EVENT_TYPE,
        createdOperation.id,
        phaseStartedAtIso,
      ),
      dueAt: phaseFinishAt,
    })
  })

  const snapshot = await getStationSnapshotForPlayer(services, playerId)
  if (!snapshot) {
    throw new MiningOperationError('station_not_found')
  }

  return snapshot
}

async function decrementAsteroidRemainingUnits(
  tx: any,
  asteroidId: string,
  deltaQuantity: number,
  now: Date,
): Promise<{ appliedDelta: number; remainingUnits: number | null }> {
  if (deltaQuantity <= 0) {
    return { appliedDelta: 0, remainingUnits: null }
  }

  await tx.execute(sql`select id from asteroid where id = ${asteroidId} for update`)

  const [asteroidRow] = await tx
    .select({
      remainingUnits: asteroid.remainingUnits,
    })
    .from(asteroid)
    .where(eq(asteroid.id, asteroidId))
    .limit(1)

  if (!asteroidRow) {
    return { appliedDelta: 0, remainingUnits: null }
  }

  const appliedDelta = Math.max(0, Math.min(deltaQuantity, asteroidRow.remainingUnits))
  const nextRemainingUnits = asteroidRow.remainingUnits - appliedDelta

  if (appliedDelta > 0) {
    await tx
      .update(asteroid)
      .set({
        remainingUnits: nextRemainingUnits,
        isDepleted: nextRemainingUnits <= 0,
        updatedAt: now,
      })
      .where(eq(asteroid.id, asteroidId))
  }

  return { appliedDelta, remainingUnits: nextRemainingUnits }
}

export async function recallMiningOperationForPlayer(
  services: AppServices,
  playerId: string,
  input: RecallMiningOperationInput,
): Promise<StationSnapshotResponse> {
  const now = new Date()
  const rigConfig = await loadMiningDockRigConfig()

  await services.db.transaction(async (tx) => {
    const [stationRow] = await tx
      .select({
        id: stations.id,
        playerId: stations.playerId,
        x: stations.x,
        y: stations.y,
      })
      .from(stations)
      .where(eq(stations.playerId, playerId))
      .limit(1)

    if (!stationRow) {
      throw new MiningOperationError('station_not_found')
    }

    await tx.execute(sql`select id from stations where id = ${stationRow.id} for update`)
    await tx.execute(
      sql`select id from mining_operations where id = ${input.operationId} and station_id = ${stationRow.id} for update`,
    )

    const [operationRow] = await tx
      .select({
        id: miningOperations.id,
        asteroidId: miningOperations.asteroidId,
        status: miningOperations.status,
        phaseStartedAt: miningOperations.phaseStartedAt,
        phaseFinishAt: miningOperations.phaseFinishAt,
        quantity: miningOperations.quantity,
        quantityTarget: miningOperations.quantityTarget,
      })
      .from(miningOperations)
      .where(
        and(
          eq(miningOperations.id, input.operationId),
          eq(miningOperations.stationId, stationRow.id),
          isNull(miningOperations.completedAt),
        ),
      )
      .limit(1)

    if (!operationRow) {
      throw new MiningOperationError('operation_not_found')
    }

    if (operationRow.status === 'returning') {
      throw new MiningOperationError('operation_not_recallable')
    }

    const [asteroidRow] = await tx
      .select({
        id: asteroid.id,
        x: asteroid.x,
        y: asteroid.y,
      })
      .from(asteroid)
      .where(eq(asteroid.id, operationRow.asteroidId))
      .limit(1)

    if (!asteroidRow) {
      throw new MiningOperationError('asteroid_not_found')
    }

    let nextQuantity = operationRow.quantity
    if (operationRow.status === 'mining') {
      const elapsedMs = Math.max(0, now.getTime() - operationRow.phaseStartedAt.getTime())
      const minedByElapsed = minedQuantityByElapsedMs(
        elapsedMs,
        operationRow.quantityTarget,
        rigConfig.miningSpeedUnitsPerMin,
      )
      const desiredQuantity = Math.max(operationRow.quantity, minedByElapsed)
      const delta = desiredQuantity - operationRow.quantity
      const decrementResult = await decrementAsteroidRemainingUnits(
        tx,
        operationRow.asteroidId,
        delta,
        now,
      )
      nextQuantity = operationRow.quantity + decrementResult.appliedDelta

      if (decrementResult.remainingUnits !== null && decrementResult.appliedDelta > 0) {
        await upsertScannedAsteroidSnapshot(tx, {
          playerId: stationRow.playerId,
          asteroidId: operationRow.asteroidId,
          remainingUnits: decrementResult.remainingUnits,
          now,
        })
      }
    }

    const fullTravelDurationMs = travelDurationMs(
      distanceUnits(stationRow.x, stationRow.y, asteroidRow.x, asteroidRow.y),
      rigConfig.moveSpeedUnitsPerMin,
    )

    let returnDurationMs = fullTravelDurationMs
    if (operationRow.status === 'flying_to_destination') {
      const elapsedSinceDepartureMs = Math.max(
        0,
        now.getTime() - operationRow.phaseStartedAt.getTime(),
      )
      if (elapsedSinceDepartureMs <= IMMEDIATE_OUTBOUND_RECALL_WINDOW_MS) {
        await tx
          .update(miningOperations)
          .set({
            status: 'returning',
            quantity: nextQuantity,
            completedAt: now,
            phaseStartedAt: now,
            phaseFinishAt: now,
            dueAt: null,
            updatedAt: now,
          })
          .where(eq(miningOperations.id, operationRow.id))

        const outboundPhaseStartedAtIso = operationRow.phaseStartedAt.toISOString()
        const outboundArrivalIdempotencyKey = eventIdempotencyKey(
          STATION_MINING_RIG_ARRIVED_EVENT_TYPE,
          operationRow.id,
          outboundPhaseStartedAtIso,
        )

        await tx
          .delete(domainEvents)
          .where(
            and(
              eq(domainEvents.stationId, stationRow.id),
              eq(domainEvents.eventType, STATION_MINING_RIG_ARRIVED_EVENT_TYPE),
              eq(domainEvents.idempotencyKey, outboundArrivalIdempotencyKey),
            ),
          )

        return
      }

      const outboundTravelDurationMs = operationRow.phaseFinishAt
        ? Math.max(0, operationRow.phaseFinishAt.getTime() - operationRow.phaseStartedAt.getTime())
        : fullTravelDurationMs
      const maxOutboundTravelMs = Math.max(0, outboundTravelDurationMs)

      // Past the instant-recall window, return travel mirrors outbound elapsed travel time.
      returnDurationMs = Math.min(elapsedSinceDepartureMs, maxOutboundTravelMs)
    }

    const returnPhaseFinishAt = new Date(now.getTime() + returnDurationMs)

    await tx
      .update(miningOperations)
      .set({
        status: 'returning',
        quantity: nextQuantity,
        phaseStartedAt: now,
        phaseFinishAt: returnPhaseFinishAt,
        dueAt: returnPhaseFinishAt,
        updatedAt: now,
      })
      .where(eq(miningOperations.id, operationRow.id))

    const returnPhaseStartedAtIso = now.toISOString()
    await tx.insert(domainEvents).values({
      stationId: stationRow.id,
      eventType: STATION_MINING_RIG_RETURNED_EVENT_TYPE,
      payloadJson: {
        operation_id: operationRow.id,
        phase_started_at: returnPhaseStartedAtIso,
      },
      idempotencyKey: eventIdempotencyKey(
        STATION_MINING_RIG_RETURNED_EVENT_TYPE,
        operationRow.id,
        returnPhaseStartedAtIso,
      ),
      dueAt: returnPhaseFinishAt,
    })
  })

  const snapshot = await getStationSnapshotForPlayer(services, playerId)
  if (!snapshot) {
    throw new MiningOperationError('station_not_found')
  }

  return snapshot
}
