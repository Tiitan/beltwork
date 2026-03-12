import { and, eq, isNull, sql } from 'drizzle-orm'
import {
  asteroid,
  domainEvents,
  miningOperations,
  scannedAsteroids,
  stationInventory,
  stations,
} from '../../db/schema.js'
import { loadMiningDockRigConfig, travelDurationMs } from '../mining-config.service.js'
import { STATION_MINING_RIG_RETURNED_EVENT_TYPE } from '../mining.service.js'

export function sameTimestamp(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime()
}

export function miningEventIdempotencyKey(
  eventType: string,
  operationId: string,
  phaseStartedAtIso: string,
) {
  return `${eventType}:${operationId}:${phaseStartedAtIso}`
}

export function distanceUnits(
  stationX: number,
  stationY: number,
  asteroidX: number,
  asteroidY: number,
): number {
  return Math.hypot(asteroidX - stationX, asteroidY - stationY)
}

export async function touchStationSimulationTime(
  tx: any,
  stationId: string,
  now: Date,
): Promise<void> {
  await tx
    .update(stations)
    .set({
      lastSimulatedAt: now,
      updatedAt: now,
    })
    .where(eq(stations.id, stationId))
}

export async function deleteDomainEvent(tx: any, eventId: string): Promise<void> {
  await tx.delete(domainEvents).where(eq(domainEvents.id, eventId))
}

export async function transitionToReturningAndEnqueue(
  tx: any,
  input: {
    operationId: string
    stationId: string
    stationX: number
    stationY: number
    asteroidX: number
    asteroidY: number
    now: Date
    returnReason?:
      | 'cargo_full'
      | 'asteroid_depleted'
      | 'destination_occupied'
      | 'destination_depleted'
  },
): Promise<void> {
  const rigConfig = await loadMiningDockRigConfig()
  const returnPhaseStartedAt = input.now
  const returnDuration = travelDurationMs(
    distanceUnits(input.stationX, input.stationY, input.asteroidX, input.asteroidY),
    rigConfig.moveSpeedUnitsPerMin,
  )
  const returnPhaseFinishAt = new Date(returnPhaseStartedAt.getTime() + returnDuration)
  const returnPhaseStartedAtIso = returnPhaseStartedAt.toISOString()

  await tx
    .update(miningOperations)
    .set({
      status: 'returning',
      phaseStartedAt: returnPhaseStartedAt,
      phaseFinishAt: returnPhaseFinishAt,
      dueAt: returnPhaseFinishAt,
      updatedAt: input.now,
    })
    .where(eq(miningOperations.id, input.operationId))

  await tx.insert(domainEvents).values({
    stationId: input.stationId,
    eventType: STATION_MINING_RIG_RETURNED_EVENT_TYPE,
    payloadJson: {
      operation_id: input.operationId,
      phase_started_at: returnPhaseStartedAtIso,
      ...(input.returnReason ? { return_reason: input.returnReason } : {}),
    },
    idempotencyKey: miningEventIdempotencyKey(
      STATION_MINING_RIG_RETURNED_EVENT_TYPE,
      input.operationId,
      returnPhaseStartedAtIso,
    ),
    dueAt: returnPhaseFinishAt,
  })
}

export async function decrementAsteroidRemainingUnits(
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

export async function upsertScannedAsteroidSnapshot(
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

export function allocateResourceBreakdown(
  quantity: number,
  composition: Record<string, number>,
): Map<string, number> {
  if (quantity <= 0) {
    return new Map()
  }

  const entries = Object.entries(composition).filter(([, ratio]) => ratio > 0)
  if (entries.length === 0) {
    return new Map()
  }

  const totalRatio = entries.reduce((accumulator, [, ratio]) => accumulator + ratio, 0)
  if (totalRatio <= 0) {
    return new Map()
  }

  const allocations = entries.map(([resourceKey, ratio]) => {
    const exact = (quantity * ratio) / totalRatio
    const base = Math.floor(exact)
    return {
      resourceKey,
      base,
      remainder: exact - base,
    }
  })

  let unallocated = quantity - allocations.reduce((sum, item) => sum + item.base, 0)
  allocations.sort((left, right) => {
    if (right.remainder !== left.remainder) {
      return right.remainder - left.remainder
    }
    return left.resourceKey.localeCompare(right.resourceKey)
  })

  for (const item of allocations) {
    if (unallocated <= 0) {
      break
    }
    item.base += 1
    unallocated -= 1
  }

  return new Map(
    allocations.filter((item) => item.base > 0).map((item) => [item.resourceKey, item.base]),
  )
}

export async function isAsteroidOccupiedByMiningOperation(
  tx: any,
  asteroidId: string,
  excludedOperationId: string,
): Promise<boolean> {
  const [occupiedAsteroid] = await tx
    .select({
      id: miningOperations.id,
    })
    .from(miningOperations)
    .where(
      and(
        eq(miningOperations.asteroidId, asteroidId),
        isNull(miningOperations.completedAt),
        eq(miningOperations.status, 'mining'),
        sql`${miningOperations.id} <> ${excludedOperationId}`,
      ),
    )
    .limit(1)

  return Boolean(occupiedAsteroid)
}

export async function creditStationInventory(
  tx: any,
  input: {
    stationId: string
    allocations: Map<string, number>
    now: Date
  },
): Promise<void> {
  for (const [resourceKey, amount] of input.allocations.entries()) {
    await tx
      .insert(stationInventory)
      .values({
        stationId: input.stationId,
        resourceKey,
        amount: String(amount),
      })
      .onConflictDoUpdate({
        target: [stationInventory.stationId, stationInventory.resourceKey],
        set: {
          amount: sql`${stationInventory.amount} + ${String(amount)}`,
          updatedAt: input.now,
        },
      })
  }
}
