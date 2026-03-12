import { and, asc, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import { domainEvents, simulationLocks } from '../db/schema.js'
import type { AppServices } from '../types/api.js'
import type {
  DomainEventHandlerDefinition,
  DomainEventHandlerRegistry,
} from './domain-events/types.js'

export const DEFAULT_STATION_LOCK_LEASE_MS = 30_000

type DomainEventDueRow = {
  id: string
  dueAt: Date
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

function resolveHandlerRegistry(services: AppServices): DomainEventHandlerRegistry<AppServices> {
  return services.domainEventHandlers ?? {}
}

function resolveHandler(
  registry: DomainEventHandlerRegistry<AppServices>,
  eventType: string,
): DomainEventHandlerDefinition<any, AppServices> | undefined {
  return registry[eventType]
}

async function deleteDomainEventById(services: AppServices, eventId: string): Promise<void> {
  await services.db.delete(domainEvents).where(eq(domainEvents.id, eventId))
}

function lockLeaseMsFromOptions(options: ProcessDueDomainEventByIdOptions): number {
  const leaseMs = options.lockLeaseMs ?? DEFAULT_STATION_LOCK_LEASE_MS
  return Math.max(1_000, leaseMs)
}

export async function prefetchDueEventsWindow(
  services: AppServices,
  _now: Date,
  dueBefore: Date,
  limit = 200,
): Promise<DomainEventDueRow[]> {
  const eventTypes = Object.keys(resolveHandlerRegistry(services))
  if (eventTypes.length === 0) {
    return []
  }

  const clampedLimit = Math.max(1, Math.min(1_000, Math.floor(limit)))

  return services.db
    .select({
      id: domainEvents.id,
      dueAt: domainEvents.dueAt,
    })
    .from(domainEvents)
    .where(
      and(
        inArray(domainEvents.eventType, eventTypes),
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

export async function processDueDomainEventById(
  services: AppServices,
  eventId: string,
  now: Date,
  options: ProcessDueDomainEventByIdOptions,
): Promise<ProcessDomainEventResult> {
  const registry = resolveHandlerRegistry(services)

  const [eventRow] = await services.db
    .select({
      id: domainEvents.id,
      stationId: domainEvents.stationId,
      eventType: domainEvents.eventType,
    })
    .from(domainEvents)
    .where(eq(domainEvents.id, eventId))
    .limit(1)

  if (!eventRow) {
    return 'missing'
  }

  if (!eventRow.stationId) {
    console.warn(`domain_event_invalid_station_id eventId=${eventRow.id}`)
    await deleteDomainEventById(services, eventRow.id)
    return 'processed'
  }

  const handler = resolveHandler(registry, eventRow.eventType)
  if (!handler) {
    console.warn(
      `domain_event_unsupported_type eventId=${eventRow.id} eventType=${eventRow.eventType}`,
    )
    await deleteDomainEventById(services, eventRow.id)
    return 'processed'
  }

  const stationId = eventRow.stationId
  const requiresStationLock = handler.requiresStationLock
  let lockAcquired = false

  if (requiresStationLock) {
    lockAcquired = await acquireStationLeaseLock(services, {
      stationId,
      lockedBy: options.lockedBy,
      now,
      leaseMs: lockLeaseMsFromOptions(options),
    })

    if (!lockAcquired) {
      return 'lock_contended'
    }
  }

  try {
    await services.db.transaction(async (tx) => {
      const [lockedEvent] = await tx
        .select({
          id: domainEvents.id,
          stationId: domainEvents.stationId,
          eventType: domainEvents.eventType,
          payloadJson: domainEvents.payloadJson,
        })
        .from(domainEvents)
        .where(eq(domainEvents.id, eventRow.id))
        .limit(1)

      if (!lockedEvent) {
        return
      }

      if (!lockedEvent.stationId) {
        console.warn(`domain_event_invalid_station_id eventId=${lockedEvent.id}`)
        await tx.delete(domainEvents).where(eq(domainEvents.id, lockedEvent.id))
        return
      }

      const lockedHandler = resolveHandler(registry, lockedEvent.eventType)
      if (!lockedHandler) {
        console.warn(
          `domain_event_unsupported_type eventId=${lockedEvent.id} eventType=${lockedEvent.eventType}`,
        )
        await tx.delete(domainEvents).where(eq(domainEvents.id, lockedEvent.id))
        return
      }

      const parsedPayload = lockedHandler.parsePayload(lockedEvent.payloadJson)
      if (!parsedPayload) {
        console.warn(`domain_event_invalid_payload eventId=${lockedEvent.id}`)
        await tx.delete(domainEvents).where(eq(domainEvents.id, lockedEvent.id))
        return
      }

      await lockedHandler.handle({
        tx,
        services,
        eventId: lockedEvent.id,
        stationId: lockedEvent.stationId,
        now,
        payload: parsedPayload,
      })
    })
  } finally {
    if (lockAcquired) {
      await releaseStationLeaseLock(services, stationId, options.lockedBy)
    }
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
