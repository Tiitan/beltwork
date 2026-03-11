import { describe, expect, it } from 'vitest'
import { db, pool } from '../db/client.js'
import type { AppServices } from '../types/api.js'
import { clearTestDatabase } from '../test/testDatabase.js'
import {
  acquireStationLeaseLock,
  processDueDomainEventById,
  releaseStationLeaseLock,
} from './domain-events.service.js'
import { STATION_BUILDING_UPGRADE_FINALIZE_EVENT_TYPE } from './station.service.js'

const services = { db } as unknown as AppServices

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
    },
  )
})
