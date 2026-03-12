import { eq, sql } from 'drizzle-orm'
import { asteroid, miningOperations } from '../../../db/schema.js'
import { loadAsteroidCompositionByTemplateId } from '../../mining-config.service.js'
import type { AppServices } from '../../../types/api.js'
import {
  parseMiningOperationPhasePayload,
  type MiningOperationPhasePayload,
} from '../payload-parsers.js'
import {
  allocateResourceBreakdown,
  creditStationInventory,
  deleteDomainEvent,
  sameTimestamp,
  touchStationSimulationTime,
} from '../game-domain-event-utils.js'
import type { DomainEventHandlerDefinition } from '../types.js'

export const stationMiningRigReturnedEventHandler: DomainEventHandlerDefinition<
  MiningOperationPhasePayload,
  AppServices
> = {
  requiresStationLock: true,
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
      })
      .from(miningOperations)
      .where(eq(miningOperations.id, input.payload.operationId))
      .limit(1)

    if (!operationRow || operationRow.stationId !== input.stationId) {
      console.warn(`domain_event_mining_returned_missing_operation eventId=${input.eventId}`)
      await deleteDomainEvent(input.tx, input.eventId)
      return
    }

    if (
      operationRow.completedAt ||
      operationRow.status !== 'returning' ||
      !sameTimestamp(operationRow.phaseStartedAt, input.payload.phaseStartedAt)
    ) {
      await deleteDomainEvent(input.tx, input.eventId)
      return
    }

    const [asteroidRow] = await input.tx
      .select({
        templateId: asteroid.templateId,
      })
      .from(asteroid)
      .where(eq(asteroid.id, operationRow.asteroidId))
      .limit(1)

    if (asteroidRow && operationRow.quantity > 0) {
      const compositionByTemplateId = await loadAsteroidCompositionByTemplateId()
      const composition = compositionByTemplateId.get(asteroidRow.templateId)
      if (composition) {
        const allocations = allocateResourceBreakdown(operationRow.quantity, composition)
        await creditStationInventory(input.tx, {
          stationId: input.stationId,
          allocations,
          now: input.now,
        })
      } else {
        console.warn(
          `domain_event_mining_returned_missing_composition eventId=${input.eventId} asteroidTemplateId=${asteroidRow.templateId}`,
        )
      }
    }

    await input.tx
      .update(miningOperations)
      .set({
        completedAt: input.now,
        phaseFinishAt: input.now,
        dueAt: null,
        updatedAt: input.now,
      })
      .where(eq(miningOperations.id, operationRow.id))

    await touchStationSimulationTime(input.tx, input.stationId, input.now)
    await deleteDomainEvent(input.tx, input.eventId)
  },
}
