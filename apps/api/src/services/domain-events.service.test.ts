import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { db, pool } from '../db/client.js'
import { domainEvents } from '../db/schema.js'
import type { AppServices } from '../types/api.js'
import { clearTestDatabase } from '../test/testDatabase.js'
import {
  acquireStationLeaseLock,
  processDueDomainEventById,
  releaseStationLeaseLock,
} from './domain-events.service.js'
import { buildGameDomainEventHandlerRegistry } from './domain-events/game-domain-event-registry.js'
import type { DomainEventHandlerRegistry } from './domain-events/types.js'
import { STATION_BUILDING_UPGRADE_FINALIZE_EVENT_TYPE } from './station.service.js'

const services = {
  db,
  domainEventHandlers: buildGameDomainEventHandlerRegistry(),
} as unknown as AppServices

function buildTestServices(
  domainEventHandlers: DomainEventHandlerRegistry<AppServices>,
): AppServices {
  return {
    db,
    domainEventHandlers,
  } as unknown as AppServices
}

async function seedStation(stationId: string, playerId: string) {
  await pool.query(`insert into players (id, display_name, auth_type) values ($1, $2, 'guest')`, [
    playerId,
    'Test Agent',
  ])
  await pool.query(`insert into stations (id, player_id, x, y) values ($1, $2, 0, 0)`, [
    stationId,
    playerId,
  ])
}

async function insertDomainEvent(params: {
  eventId: string
  stationId: string
  eventType: string
  payload: Record<string, unknown>
  dueAt: Date
}) {
  await pool.query(
    `insert into domain_events (id, station_id, event_type, payload_json, idempotency_key, due_at)
     values ($1, $2, $3, $4::jsonb, $5, $6)`,
    [
      params.eventId,
      params.stationId,
      params.eventType,
      JSON.stringify(params.payload),
      `event-${params.eventId}`,
      params.dueAt,
    ],
  )
}

async function eventExists(eventId: string): Promise<boolean> {
  const queryResult = await pool.query(`select id from domain_events where id = $1`, [eventId])
  return queryResult.rows.length > 0
}

async function journalEntryCount(): Promise<number> {
  const queryResult = await pool.query(
    `select count(*)::integer as count from player_journal_entries`,
  )
  return queryResult.rows[0]?.count ?? 0
}

describe('domain events locks', () => {
  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'acquires lease, blocks competing agent, and allows release by owner only',
    async () => {
      await clearTestDatabase()

      const stationId = '00000000-0000-0000-0000-000000000101'
      const playerId = '00000000-0000-0000-0000-000000000001'
      await seedStation(stationId, playerId)

      const now = new Date('2026-03-11T18:00:00.000Z')
      const acquiredByA = await acquireStationLeaseLock(services, {
        stationId,
        lockedBy: 'agent-a',
        now,
        leaseMs: 30_000,
      })
      expect(acquiredByA).toBe(true)

      const acquiredByB = await acquireStationLeaseLock(services, {
        stationId,
        lockedBy: 'agent-b',
        now: new Date(now.getTime() + 1_000),
        leaseMs: 30_000,
      })
      expect(acquiredByB).toBe(false)

      const releasedByWrongOwner = await releaseStationLeaseLock(services, stationId, 'agent-b')
      expect(releasedByWrongOwner).toBe(false)

      const releasedByOwner = await releaseStationLeaseLock(services, stationId, 'agent-a')
      expect(releasedByOwner).toBe(true)

      const acquiredAfterRelease = await acquireStationLeaseLock(services, {
        stationId,
        lockedBy: 'agent-b',
        now: new Date(now.getTime() + 2_000),
        leaseMs: 30_000,
      })
      expect(acquiredAfterRelease).toBe(true)
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')('allows stealing an expired lease', async () => {
    await clearTestDatabase()

    const stationId = '00000000-0000-0000-0000-000000000102'
    const playerId = '00000000-0000-0000-0000-000000000002'
    await seedStation(stationId, playerId)

    const start = new Date('2026-03-11T18:05:00.000Z')
    const acquiredByA = await acquireStationLeaseLock(services, {
      stationId,
      lockedBy: 'agent-a',
      now: start,
      leaseMs: 1_000,
    })
    expect(acquiredByA).toBe(true)

    const acquiredByB = await acquireStationLeaseLock(services, {
      stationId,
      lockedBy: 'agent-b',
      now: new Date(start.getTime() + 2_000),
      leaseMs: 30_000,
    })
    expect(acquiredByB).toBe(true)
  })
})

describe('processDueDomainEventById', () => {
  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'dispatches by event type via handler registry',
    async () => {
      await clearTestDatabase()

      const stationId = '00000000-0000-0000-0000-000000000140'
      const playerId = '00000000-0000-0000-0000-000000000040'
      const eventId = '00000000-0000-0000-0000-000000000340'
      const eventType = 'tests.domain-events.dispatch.v1'
      await seedStation(stationId, playerId)

      let handledPayload: unknown = null
      const testServices = buildTestServices({
        [eventType]: {
          requiresStationLock: false,
          parsePayload(payloadJson) {
            if (
              typeof payloadJson === 'object' &&
              payloadJson !== null &&
              'value' in payloadJson &&
              typeof (payloadJson as { value: unknown }).value === 'number'
            ) {
              return { value: (payloadJson as { value: number }).value }
            }
            return null
          },
          async handle(input) {
            handledPayload = input.payload
            await input.tx.delete(domainEvents).where(eq(domainEvents.id, input.eventId))
          },
        },
      })

      await insertDomainEvent({
        eventId,
        stationId,
        eventType,
        payload: { value: 7 },
        dueAt: new Date('2026-03-11T18:30:00.000Z'),
      })

      const result = await processDueDomainEventById(
        testServices,
        eventId,
        new Date('2026-03-11T18:30:01.000Z'),
        { lockedBy: 'agent-test' },
      )

      expect(result).toBe('processed')
      expect(handledPayload).toEqual({ value: 7 })
      expect(await eventExists(eventId)).toBe(false)
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'warns and deletes unsupported event types',
    async () => {
      await clearTestDatabase()

      const stationId = '00000000-0000-0000-0000-000000000141'
      const playerId = '00000000-0000-0000-0000-000000000041'
      const eventId = '00000000-0000-0000-0000-000000000341'
      await seedStation(stationId, playerId)

      const testServices = buildTestServices({})
      await insertDomainEvent({
        eventId,
        stationId,
        eventType: 'tests.domain-events.unsupported.v1',
        payload: { anything: true },
        dueAt: new Date('2026-03-11T18:31:00.000Z'),
      })

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        const result = await processDueDomainEventById(
          testServices,
          eventId,
          new Date('2026-03-11T18:31:01.000Z'),
          { lockedBy: 'agent-test' },
        )

        expect(result).toBe('processed')
        expect(await eventExists(eventId)).toBe(false)
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('domain_event_unsupported_type'),
        )
        expect(await journalEntryCount()).toBe(0)
      } finally {
        warnSpy.mockRestore()
      }
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'warns and deletes events with invalid payload',
    async () => {
      await clearTestDatabase()

      const stationId = '00000000-0000-0000-0000-000000000142'
      const playerId = '00000000-0000-0000-0000-000000000042'
      const eventId = '00000000-0000-0000-0000-000000000342'
      const eventType = 'tests.domain-events.invalid-payload.v1'
      await seedStation(stationId, playerId)

      let handleCalled = false
      const testServices = buildTestServices({
        [eventType]: {
          requiresStationLock: false,
          parsePayload() {
            return null
          },
          async handle() {
            handleCalled = true
          },
        },
      })

      await insertDomainEvent({
        eventId,
        stationId,
        eventType,
        payload: { broken: 'payload' },
        dueAt: new Date('2026-03-11T18:32:00.000Z'),
      })

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        const result = await processDueDomainEventById(
          testServices,
          eventId,
          new Date('2026-03-11T18:32:01.000Z'),
          { lockedBy: 'agent-test' },
        )

        expect(result).toBe('processed')
        expect(handleCalled).toBe(false)
        expect(await eventExists(eventId)).toBe(false)
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('domain_event_invalid_payload'),
        )
        expect(await journalEntryCount()).toBe(0)
      } finally {
        warnSpy.mockRestore()
      }
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'respects lock policy metadata in registry handlers',
    async () => {
      await clearTestDatabase()

      const stationId = '00000000-0000-0000-0000-000000000143'
      const playerId = '00000000-0000-0000-0000-000000000043'
      const lockedEventId = '00000000-0000-0000-0000-000000000343'
      const unlockedEventId = '00000000-0000-0000-0000-000000000344'
      const lockedType = 'tests.domain-events.locked.v1'
      const unlockedType = 'tests.domain-events.unlocked.v1'
      await seedStation(stationId, playerId)

      let lockedHandleCalls = 0
      let unlockedHandleCalls = 0
      const testServices = buildTestServices({
        [lockedType]: {
          requiresStationLock: true,
          parsePayload(payloadJson) {
            if (
              typeof payloadJson === 'object' &&
              payloadJson !== null &&
              'value' in payloadJson &&
              typeof (payloadJson as { value: unknown }).value === 'number'
            ) {
              return { value: (payloadJson as { value: number }).value }
            }
            return null
          },
          async handle(input) {
            lockedHandleCalls += 1
            await input.tx.delete(domainEvents).where(eq(domainEvents.id, input.eventId))
          },
        },
        [unlockedType]: {
          requiresStationLock: false,
          parsePayload(payloadJson) {
            if (
              typeof payloadJson === 'object' &&
              payloadJson !== null &&
              'value' in payloadJson &&
              typeof (payloadJson as { value: unknown }).value === 'number'
            ) {
              return { value: (payloadJson as { value: number }).value }
            }
            return null
          },
          async handle(input) {
            unlockedHandleCalls += 1
            await input.tx.delete(domainEvents).where(eq(domainEvents.id, input.eventId))
          },
        },
      })

      await pool.query(
        `insert into simulation_locks (station_id, locked_by, locked_at, expires_at)
       values ($1, $2, $3, $4)`,
        [
          stationId,
          'other-agent',
          new Date('2026-03-11T18:33:00.000Z'),
          new Date('2026-03-11T18:33:30.000Z'),
        ],
      )

      await insertDomainEvent({
        eventId: lockedEventId,
        stationId,
        eventType: lockedType,
        payload: { value: 1 },
        dueAt: new Date('2026-03-11T18:33:00.000Z'),
      })
      await insertDomainEvent({
        eventId: unlockedEventId,
        stationId,
        eventType: unlockedType,
        payload: { value: 2 },
        dueAt: new Date('2026-03-11T18:33:00.000Z'),
      })

      const lockedResult = await processDueDomainEventById(
        testServices,
        lockedEventId,
        new Date('2026-03-11T18:33:01.000Z'),
        { lockedBy: 'agent-test' },
      )
      expect(lockedResult).toBe('lock_contended')
      expect(lockedHandleCalls).toBe(0)
      expect(await eventExists(lockedEventId)).toBe(true)

      const unlockedResult = await processDueDomainEventById(
        testServices,
        unlockedEventId,
        new Date('2026-03-11T18:33:02.000Z'),
        { lockedBy: 'agent-test' },
      )
      expect(unlockedResult).toBe('processed')
      expect(unlockedHandleCalls).toBe(1)
      expect(await eventExists(unlockedEventId)).toBe(false)
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'keeps event pending on lock contention then finalizes after lock is released',
    async () => {
      await clearTestDatabase()

      const stationId = '00000000-0000-0000-0000-000000000103'
      const playerId = '00000000-0000-0000-0000-000000000003'
      const buildingId = '00000000-0000-0000-0000-000000000201'
      const eventId = '00000000-0000-0000-0000-000000000301'
      const upgradeStartedAt = new Date('2026-03-11T18:10:00.000Z')

      await seedStation(stationId, playerId)
      await pool.query(
        `insert into station_buildings (id, station_id, slot_index, building_type, level, upgrade_started_at)
         values ($1, $2, 1, 'storage', 1, $3)`,
        [buildingId, stationId, upgradeStartedAt],
      )
      await pool.query(
        `insert into domain_events (id, station_id, event_type, payload_json, idempotency_key, due_at)
         values ($1, $2, $3, $4::jsonb, $5, $6)`,
        [
          eventId,
          stationId,
          STATION_BUILDING_UPGRADE_FINALIZE_EVENT_TYPE,
          JSON.stringify({
            building_id: buildingId,
            upgrade_started_at: upgradeStartedAt.toISOString(),
          }),
          `event-${eventId}`,
          new Date(upgradeStartedAt.getTime() + 1_000),
        ],
      )
      await pool.query(
        `insert into simulation_locks (station_id, locked_by, locked_at, expires_at)
         values ($1, $2, $3, $4)`,
        [
          stationId,
          'other-agent',
          new Date('2026-03-11T18:10:01.000Z'),
          new Date('2026-03-11T18:10:31.000Z'),
        ],
      )

      const lockContended = await processDueDomainEventById(
        services,
        eventId,
        new Date('2026-03-11T18:10:02.000Z'),
        { lockedBy: 'agent-a' },
      )
      expect(lockContended).toBe('lock_contended')

      const [buildingDuringLock] = (
        await pool.query(
          `select level, upgrade_started_at from station_buildings where id = $1 limit 1`,
          [buildingId],
        )
      ).rows
      expect(buildingDuringLock?.level).toBe(1)
      expect(buildingDuringLock?.upgrade_started_at).not.toBeNull()

      const [eventDuringLock] = (
        await pool.query(`select id from domain_events where id = $1 limit 1`, [eventId])
      ).rows
      expect(eventDuringLock?.id).toBe(eventId)

      await pool.query(`delete from simulation_locks where station_id = $1`, [stationId])

      const processed = await processDueDomainEventById(
        services,
        eventId,
        new Date('2026-03-11T18:10:03.000Z'),
        { lockedBy: 'agent-a' },
      )
      expect(processed).toBe('processed')

      const [buildingAfterProcess] = (
        await pool.query(
          `select level, upgrade_started_at from station_buildings where id = $1 limit 1`,
          [buildingId],
        )
      ).rows
      expect(buildingAfterProcess?.level).toBe(2)
      expect(buildingAfterProcess?.upgrade_started_at).toBeNull()

      const eventAfterProcess = await pool.query(`select id from domain_events where id = $1`, [
        eventId,
      ])
      expect(eventAfterProcess.rows).toHaveLength(0)

      const journalEntriesResult = await pool.query(
        `select importance, description from player_journal_entries order by occurred_at desc limit 1`,
      )
      expect(journalEntriesResult.rows).toHaveLength(1)
      expect(journalEntriesResult.rows[0]).toMatchObject({
        importance: 'important',
        description: 'Storage upgraded to level 2!',
      })
    },
  )
})
