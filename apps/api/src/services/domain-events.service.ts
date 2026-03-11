import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { domainEvents, simulationLocks, stationBuildings, stations } from '../db/schema.js'
import type { AppServices } from '../types/api.js'
import { STATION_BUILDING_UPGRADE_FINALIZE_EVENT_TYPE } from './station.service.js'

const upgradeFinalizePayloadSchema = z.object({
  building_id: z.string().min(1),
  upgrade_started_at: z.string().min(1),
})

export const DEFAULT_STATION_LOCK_LEASE_MS = 30_000

type DomainEventDueRow = {
  id: string
  dueAt: Date
}

type UpgradeFinalizePayload = {
  buildingId: string
  upgradeStartedAt: Date
}

export type ProcessDomainEventResult = 'processed' | 'missing' | 'lock_contended'

type ProcessDueDomainEventByIdOptions = {
  lockedBy: string
  lockLeaseMs?: number
}

type StationLeaseLockInput = {
  stationId: string
  lockedBy: string
  now: Date
  leaseMs: number
}

function toValidDate(value: string): Date | null {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseUpgradeFinalizePayload(payload: unknown): UpgradeFinalizePayload | null {
  const parsedPayload = upgradeFinalizePayloadSchema.safeParse(payload)
  if (!parsedPayload.success) {
    return null
  }

  const upgradeStartedAt = toValidDate(parsedPayload.data.upgrade_started_at)
  if (!upgradeStartedAt) {
    return null
  }

  return {
    buildingId: parsedPayload.data.building_id,
    upgradeStartedAt,
  }
}

export async function prefetchDueEventsWindow(
  services: AppServices,
  now: Date,
  dueBefore: Date,
  limit = 200,
): Promise<DomainEventDueRow[]> {
  const clampedLimit = Math.max(1, Math.min(1_000, Math.floor(limit)))

  return services.db
    .select({
      id: domainEvents.id,
      dueAt: domainEvents.dueAt,
    })
    .from(domainEvents)
    .where(
      and(
        eq(domainEvents.eventType, STATION_BUILDING_UPGRADE_FINALIZE_EVENT_TYPE),
        isNull(domainEvents.processedAt),
        lte(domainEvents.dueAt, dueBefore),
      ),
    )
    .orderBy(asc(domainEvents.dueAt), asc(domainEvents.id))
    .limit(clampedLimit)
}

export async function acquireStationLeaseLock(
  services: AppServices,
  input: StationLeaseLockInput,
): Promise<boolean> {
  const expiresAt = new Date(input.now.getTime() + input.leaseMs)
  const queryResult = (await services.db.execute(sql`
    insert into simulation_locks ("station_id", "locked_by", "locked_at", "expires_at")
    values (${input.stationId}, ${input.lockedBy}, ${input.now}, ${expiresAt})
    on conflict ("station_id") do update
      set "locked_by" = excluded."locked_by",
          "locked_at" = excluded."locked_at",
          "expires_at" = excluded."expires_at"
    where simulation_locks."expires_at" <= ${input.now}
    returning "station_id"
  `)) as { rows?: unknown[] }

  return (queryResult.rows?.length ?? 0) > 0
}

export async function releaseStationLeaseLock(
  services: AppServices,
  stationId: string,
  lockedBy: string,
): Promise<boolean> {
  const releasedRows = await services.db
    .delete(simulationLocks)
    .where(and(eq(simulationLocks.stationId, stationId), eq(simulationLocks.lockedBy, lockedBy)))
    .returning({
      stationId: simulationLocks.stationId,
    })

  return releasedRows.length > 0
}

function lockLeaseMsFromOptions(options: ProcessDueDomainEventByIdOptions): number {
  const leaseMs = options.lockLeaseMs ?? DEFAULT_STATION_LOCK_LEASE_MS
  return Math.max(1_000, leaseMs)
}

export async function processDueDomainEventById(
  services: AppServices,
  eventId: string,
  now: Date,
  options: ProcessDueDomainEventByIdOptions,
): Promise<ProcessDomainEventResult> {
  const [eventRow] = await services.db
    .select({
      id: domainEvents.id,
      stationId: domainEvents.stationId,
      payloadJson: domainEvents.payloadJson,
    })
    .from(domainEvents)
    .where(eq(domainEvents.id, eventId))
    .limit(1)

  if (!eventRow) {
    return 'missing'
  }

  if (!eventRow.stationId) {
    console.warn(`domain_event_invalid_station_id eventId=${eventRow.id}`)
    await services.db.delete(domainEvents).where(eq(domainEvents.id, eventRow.id))
    return 'processed'
  }
  const stationId = eventRow.stationId

  const parsedPayload = parseUpgradeFinalizePayload(eventRow.payloadJson)
  if (!parsedPayload) {
    console.warn(`domain_event_invalid_payload eventId=${eventRow.id}`)
    await services.db.delete(domainEvents).where(eq(domainEvents.id, eventRow.id))
    return 'processed'
  }

  const lockAcquired = await acquireStationLeaseLock(services, {
    stationId,
    lockedBy: options.lockedBy,
    now,
    leaseMs: lockLeaseMsFromOptions(options),
  })

  if (!lockAcquired) {
    return 'lock_contended'
  }

  try {
    await services.db.transaction(async (tx) => {
      const [lockedEventRow] = await tx
        .select({
          id: domainEvents.id,
        })
        .from(domainEvents)
        .where(eq(domainEvents.id, eventRow.id))
        .limit(1)

      if (!lockedEventRow) {
        return
      }

      const [updatedBuilding] = await tx
        .update(stationBuildings)
        .set({
          level: sql`${stationBuildings.level} + 1`,
          upgradeStartedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(stationBuildings.id, parsedPayload.buildingId),
            eq(stationBuildings.stationId, stationId),
            eq(stationBuildings.upgradeStartedAt, parsedPayload.upgradeStartedAt),
          ),
        )
        .returning({
          id: stationBuildings.id,
        })

      if (!updatedBuilding) {
        console.warn(
          `domain_event_upgrade_finalize_skipped eventId=${eventRow.id} buildingId=${parsedPayload.buildingId}`,
        )
        await tx.delete(domainEvents).where(eq(domainEvents.id, eventRow.id))
        return
      }

      await tx
        .update(stations)
        .set({
          lastSimulatedAt: now,
          updatedAt: now,
        })
        .where(eq(stations.id, stationId))

      await tx.delete(domainEvents).where(eq(domainEvents.id, eventRow.id))
    })
  } finally {
    await releaseStationLeaseLock(services, stationId, options.lockedBy)
  }

  return 'processed'
}

export async function processDueDomainEventsOnce(
  services: AppServices,
  now: Date,
  limit = 50,
): Promise<number> {
  const dueEvents = await prefetchDueEventsWindow(services, now, now, limit)
  let processedCount = 0

  for (const event of dueEvents) {
    const result = await processDueDomainEventById(services, event.id, now, {
      lockedBy: `domain-events-once:${process.pid}`,
    })
    if (result === 'processed') {
      processedCount += 1
    }
  }

  return processedCount
}
