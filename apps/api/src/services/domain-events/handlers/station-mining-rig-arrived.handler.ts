import { eq, sql } from 'drizzle-orm'
import { asteroid, domainEvents, miningOperations, stations } from '../../../db/schema.js'
import { loadMiningDockRigConfig, miningDurationMs } from '../../mining-config.service.js'
import { STATION_MINING_COMPLETED_EVENT_TYPE } from '../../mining.service.js'
import type { AppServices } from '../../../types/api.js'
import { createPlayerJournalEntry } from '../../journal.service.js'
import {
  parseMiningOperationPhasePayload,
  type MiningOperationPhasePayload,
} from '../payload-parsers.js'
import {
  deleteDomainEvent,
  isAsteroidOccupiedByMiningOperation,
  miningEventIdempotencyKey,
  sameTimestamp,
  touchStationSimulationTime,
  transitionToReturningAndEnqueue,
} from '../game-domain-event-utils.js'
import type { DomainEventHandlerDefinition } from '../types.js'

export const stationMiningRigArrivedEventHandler: DomainEventHandlerDefinition<
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
        cargoCapacity: miningOperations.cargoCapacity,
      })
      .from(miningOperations)
      .where(eq(miningOperations.id, input.payload.operationId))
      .limit(1)

    if (!operationRow || operationRow.stationId !== input.stationId) {
      console.warn(`domain_event_mining_arrival_missing_operation eventId=${input.eventId}`)
      await deleteDomainEvent(input.tx, input.eventId)
      return
    }

    if (
      operationRow.completedAt ||
      operationRow.status !== 'flying_to_destination' ||
      !sameTimestamp(operationRow.phaseStartedAt, input.payload.phaseStartedAt)
    ) {
      await deleteDomainEvent(input.tx, input.eventId)
      return
    }

    const [stationRow] = await input.tx
      .select({
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
        remainingUnits: asteroid.remainingUnits,
        isDepleted: asteroid.isDepleted,
      })
      .from(asteroid)
      .where(eq(asteroid.id, operationRow.asteroidId))
      .limit(1)

    if (!stationRow || !asteroidRow) {
      console.warn(
        `domain_event_mining_arrival_missing_station_or_asteroid eventId=${input.eventId}`,
      )
      await deleteDomainEvent(input.tx, input.eventId)
      return
    }

    const isOccupied = await isAsteroidOccupiedByMiningOperation(
      input.tx,
      operationRow.asteroidId,
      operationRow.id,
    )

    if (isOccupied) {
      await transitionToReturningAndEnqueue(input.tx, {
        operationId: operationRow.id,
        stationId: input.stationId,
        stationX: stationRow.x,
        stationY: stationRow.y,
        asteroidX: asteroidRow.x,
        asteroidY: asteroidRow.y,
        now: input.now,
        returnReason: 'destination_occupied',
      })
      await touchStationSimulationTime(input.tx, input.stationId, input.now)
      await createPlayerJournalEntry(input.tx, {
        stationId: input.stationId,
        eventType: 'station.mining.rig.arrived.v1',
        importance: 'warning',
        description: 'Mining rig arrived on an occupied destination!',
        occurredAt: input.now,
        metadataJson: {
          operation_id: operationRow.id,
          asteroid_id: operationRow.asteroidId,
          outcome: 'occupied_destination',
        },
      })
      await deleteDomainEvent(input.tx, input.eventId)
      return
    }

    if (asteroidRow.isDepleted || asteroidRow.remainingUnits <= 0) {
      await transitionToReturningAndEnqueue(input.tx, {
        operationId: operationRow.id,
        stationId: input.stationId,
        stationX: stationRow.x,
        stationY: stationRow.y,
        asteroidX: asteroidRow.x,
        asteroidY: asteroidRow.y,
        now: input.now,
        returnReason: 'destination_depleted',
      })
      await touchStationSimulationTime(input.tx, input.stationId, input.now)
      await createPlayerJournalEntry(input.tx, {
        stationId: input.stationId,
        eventType: 'station.mining.rig.arrived.v1',
        importance: 'warning',
        description: 'Mining rig arrived at a depleted destination!',
        occurredAt: input.now,
        metadataJson: {
          operation_id: operationRow.id,
          asteroid_id: operationRow.asteroidId,
          outcome: 'depleted_destination',
        },
      })
      await deleteDomainEvent(input.tx, input.eventId)
      return
    }

    const quantityTarget = Math.min(operationRow.cargoCapacity, asteroidRow.remainingUnits)
    if (quantityTarget <= 0) {
      await transitionToReturningAndEnqueue(input.tx, {
        operationId: operationRow.id,
        stationId: input.stationId,
        stationX: stationRow.x,
        stationY: stationRow.y,
        asteroidX: asteroidRow.x,
        asteroidY: asteroidRow.y,
        now: input.now,
        returnReason: 'destination_depleted',
      })
      await touchStationSimulationTime(input.tx, input.stationId, input.now)
      await createPlayerJournalEntry(input.tx, {
        stationId: input.stationId,
        eventType: 'station.mining.rig.arrived.v1',
        importance: 'warning',
        description: 'Mining rig arrived at a depleted destination!',
        occurredAt: input.now,
        metadataJson: {
          operation_id: operationRow.id,
          asteroid_id: operationRow.asteroidId,
          outcome: 'depleted_destination',
        },
      })
      await deleteDomainEvent(input.tx, input.eventId)
      return
    }

    const miningPhaseStartedAt = input.now
    const rigConfig = await loadMiningDockRigConfig()
    const miningPhaseDuration = miningDurationMs(quantityTarget, rigConfig.miningSpeedUnitsPerMin)
    const miningPhaseFinishAt = new Date(miningPhaseStartedAt.getTime() + miningPhaseDuration)
    const miningPhaseStartedAtIso = miningPhaseStartedAt.toISOString()

    await input.tx
      .update(miningOperations)
      .set({
        status: 'mining',
        quantityTarget,
        asteroidRemainingUnitsAtMiningStart: asteroidRow.remainingUnits,
        phaseStartedAt: miningPhaseStartedAt,
        phaseFinishAt: miningPhaseFinishAt,
        dueAt: miningPhaseFinishAt,
        updatedAt: input.now,
      })
      .where(eq(miningOperations.id, operationRow.id))

    await input.tx.insert(domainEvents).values({
      stationId: input.stationId,
      eventType: STATION_MINING_COMPLETED_EVENT_TYPE,
      payloadJson: {
        operation_id: operationRow.id,
        phase_started_at: miningPhaseStartedAtIso,
      },
      idempotencyKey: miningEventIdempotencyKey(
        STATION_MINING_COMPLETED_EVENT_TYPE,
        operationRow.id,
        miningPhaseStartedAtIso,
      ),
      dueAt: miningPhaseFinishAt,
    })

    await touchStationSimulationTime(input.tx, input.stationId, input.now)
    await createPlayerJournalEntry(input.tx, {
      stationId: input.stationId,
      eventType: 'station.mining.rig.arrived.v1',
      importance: 'info',
      description: 'Mining rig arrived at destination',
      occurredAt: input.now,
      metadataJson: {
        operation_id: operationRow.id,
        asteroid_id: operationRow.asteroidId,
        outcome: 'started_mining',
      },
    })
    await deleteDomainEvent(input.tx, input.eventId)
  },
}
