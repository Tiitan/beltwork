import { and, eq, sql } from 'drizzle-orm'
import { stationBuildings } from '../../../db/schema.js'
import type { AppServices } from '../../../types/api.js'
import { parseUpgradeFinalizePayload, type UpgradeFinalizePayload } from '../payload-parsers.js'
import { deleteDomainEvent, touchStationSimulationTime } from '../game-domain-event-utils.js'
import type { DomainEventHandlerDefinition } from '../types.js'

export const stationBuildingUpgradeFinalizeEventHandler: DomainEventHandlerDefinition<
  UpgradeFinalizePayload,
  AppServices
> = {
  requiresStationLock: true,
  parsePayload: parseUpgradeFinalizePayload,
  async handle(input) {
    const [updatedBuilding] = await input.tx
      .update(stationBuildings)
      .set({
        level: sql`${stationBuildings.level} + 1`,
        upgradeStartedAt: null,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(stationBuildings.id, input.payload.buildingId),
          eq(stationBuildings.stationId, input.stationId),
          eq(stationBuildings.upgradeStartedAt, input.payload.upgradeStartedAt),
        ),
      )
      .returning({
        id: stationBuildings.id,
      })

    if (!updatedBuilding) {
      console.warn(
        `domain_event_upgrade_finalize_skipped eventId=${input.eventId} buildingId=${input.payload.buildingId}`,
      )
      await deleteDomainEvent(input.tx, input.eventId)
      return
    }

    await touchStationSimulationTime(input.tx, input.stationId, input.now)
    await deleteDomainEvent(input.tx, input.eventId)
  },
}
