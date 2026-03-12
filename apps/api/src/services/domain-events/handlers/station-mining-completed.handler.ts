import { eq, sql } from 'drizzle-orm'
import { asteroid, miningOperations, stations } from '../../../db/schema.js'
import type { AppServices } from '../../../types/api.js'
import {
  parseMiningOperationPhasePayload,
  type MiningOperationPhasePayload,
} from '../payload-parsers.js'
import {
  decrementAsteroidRemainingUnits,
  deleteDomainEvent,
  sameTimestamp,
  touchStationSimulationTime,
  transitionToReturningAndEnqueue,
  upsertScannedAsteroidSnapshot,
} from '../game-domain-event-utils.js'
import type { DomainEventHandlerDefinition } from '../types.js'

export const stationMiningCompletedEventHandler: DomainEventHandlerDefinition<
  MiningOperationPhasePayload,
  AppServices
> = {
  requiresStationLock: false,
  parsePayload: parseMiningOperationPhasePayload,
  async handle(input) {
    await input.tx.execute(
      sql`select id from mining_operations where id = ${input.payload.operationId} and station_id = ${input.stationId} for update`,
    )

    const [operationRow] = await input.tx
      .select({
        id: miningOperations.id,
        stationId: miningOperations.stationId,
        asteroidId: miningOperations.asteroidId,
        status: miningOperations.status,
        phaseStartedAt: miningOperations.phaseStartedAt,
        completedAt: miningOperations.completedAt,
        quantity: miningOperations.quantity,
        quantityTarget: miningOperations.quantityTarget,
      })
      .from(miningOperations)
      .where(eq(miningOperations.id, input.payload.operationId))
      .limit(1)

    if (!operationRow || operationRow.stationId !== input.stationId) {
      console.warn(`domain_event_mining_completed_missing_operation eventId=${input.eventId}`)
      await deleteDomainEvent(input.tx, input.eventId)
      return
    }

    if (
      operationRow.completedAt ||
      operationRow.status !== 'mining' ||
      !sameTimestamp(operationRow.phaseStartedAt, input.payload.phaseStartedAt)
    ) {
      await deleteDomainEvent(input.tx, input.eventId)
      return
    }

    const [stationRow] = await input.tx
      .select({
        playerId: stations.playerId,
        x: stations.x,
        y: stations.y,
      })
      .from(stations)
      .where(eq(stations.id, input.stationId))
      .limit(1)
    const [asteroidRow] = await input.tx
      .select({
        id: asteroid.id,
        x: asteroid.x,
        y: asteroid.y,
      })
      .from(asteroid)
      .where(eq(asteroid.id, operationRow.asteroidId))
      .limit(1)

    if (!stationRow || !asteroidRow) {
      console.warn(
        `domain_event_mining_completed_missing_station_or_asteroid eventId=${input.eventId}`,
      )
      await deleteDomainEvent(input.tx, input.eventId)
      return
    }

    const desiredQuantity = operationRow.quantityTarget
    const deltaQuantity = Math.max(0, desiredQuantity - operationRow.quantity)
    const decrementResult = await decrementAsteroidRemainingUnits(
      input.tx,
      operationRow.asteroidId,
      deltaQuantity,
      input.now,
    )
    const nextQuantity = operationRow.quantity + decrementResult.appliedDelta

    if (decrementResult.remainingUnits !== null && decrementResult.appliedDelta > 0) {
      await upsertScannedAsteroidSnapshot(input.tx, {
        playerId: stationRow.playerId,
        asteroidId: operationRow.asteroidId,
        remainingUnits: decrementResult.remainingUnits,
        now: input.now,
      })
    }

    await input.tx
      .update(miningOperations)
      .set({
        quantity: nextQuantity,
        updatedAt: input.now,
      })
      .where(eq(miningOperations.id, operationRow.id))

    const returnReason =
      decrementResult.remainingUnits !== null && decrementResult.remainingUnits <= 0
        ? 'asteroid_depleted'
        : 'cargo_full'

    await transitionToReturningAndEnqueue(input.tx, {
      operationId: operationRow.id,
      stationId: input.stationId,
      stationX: stationRow.x,
      stationY: stationRow.y,
      asteroidX: asteroidRow.x,
      asteroidY: asteroidRow.y,
      now: input.now,
      returnReason,
    })

    await touchStationSimulationTime(input.tx, input.stationId, input.now)
    await deleteDomainEvent(input.tx, input.eventId)
  },
}
