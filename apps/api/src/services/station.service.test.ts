import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asteroid, stationInventory, stations } from '../db/schema.js'
import { startupResources } from '../station/newStationConfig.js'

vi.mock('../map/config.js', () => ({
  loadMapConfig: vi.fn(),
}))

vi.mock('../map/placement.js', () => ({
  findPointWithFallback: vi.fn(),
}))

import { loadMapConfig } from '../map/config.js'
import { findPointWithFallback } from '../map/placement.js'
import { createStationForPlayer } from './station.service.js'

type FakeDbOptions = {
  stationPoints: Array<{ x: number; y: number }>
  asteroidPoints: Array<{ x: number; y: number }>
  insertedStationId: string | null
  existingStationId?: string | null
}

function createFakeDb(options: FakeDbOptions) {
  const captures: {
    insertedStationValues: { playerId: string; x: number; y: number } | null
    insertedInventoryValues: Array<{
      stationId: string
      resourceKey: string
      amount: string
    }> | null
  } = {
    insertedStationValues: null,
    insertedInventoryValues: null,
  }

  const db = {
    select(selection: Record<string, unknown>) {
      return {
        from(table: unknown) {
          if (table === stations && 'x' in selection && 'y' in selection) {
            return Promise.resolve(options.stationPoints)
          }

          if (table === asteroid && 'x' in selection && 'y' in selection) {
            return Promise.resolve(options.asteroidPoints)
          }

          if (table === stations && 'id' in selection) {
            return {
              where() {
                return {
                  limit() {
                    return Promise.resolve(
                      options.existingStationId ? [{ id: options.existingStationId }] : [],
                    )
                  },
                }
              },
            }
          }

          throw new Error('unexpected select.from invocation')
        },
      }
    },
    insert(table: unknown) {
      if (table === stations) {
        return {
          values(payload: { playerId: string; x: number; y: number }) {
            captures.insertedStationValues = payload
            return {
              onConflictDoNothing() {
                return {
                  returning() {
                    return Promise.resolve(
                      options.insertedStationId ? [{ id: options.insertedStationId }] : [],
                    )
                  },
                }
              },
            }
          },
        }
      }

      if (table === stationInventory) {
        return {
          values(payload: Array<{ stationId: string; resourceKey: string; amount: string }>) {
            captures.insertedInventoryValues = payload
            return Promise.resolve([])
          },
        }
      }

      throw new Error('unexpected insert invocation')
    },
  }

  return { db, captures }
}

describe('createStationForPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadMapConfig).mockResolvedValue({
      worldBounds: { minX: 0, maxX: 10000, minY: 0, maxY: 10000 },
      spawnConstraints: {
        minStationToAsteroidDistance: 250,
        minAsteroidSeparation: 120,
      },
      stationSpawnRules: {
        avoidOverlapRadius: 120,
      },
      asteroidSpawnRules: {
        targetNonDepletedAsteroids: 200,
      },
    })
  })

  it('uses map placement result for station insert and seeds startup inventory', async () => {
    const { db, captures } = createFakeDb({
      stationPoints: [{ x: 100, y: 100 }],
      asteroidPoints: [{ x: 1000, y: 1000 }],
      insertedStationId: 'st-new',
    })

    vi.mocked(findPointWithFallback).mockReturnValue({
      point: { x: 321, y: 654 },
      usedFallback: false,
    })

    const stationId = await createStationForPlayer(
      { db } as unknown as Parameters<typeof createStationForPlayer>[0],
      'player-1',
    )

    expect(stationId).toBe('st-new')
    expect(captures.insertedStationValues).toEqual({
      playerId: 'player-1',
      x: 321,
      y: 654,
    })

    expect(findPointWithFallback).toHaveBeenCalledTimes(1)
    expect(vi.mocked(findPointWithFallback).mock.calls[0]?.[0]).toMatchObject({
      worldBounds: { minX: 0, maxX: 10000, minY: 0, maxY: 10000 },
      maxAttempts: 5000,
      rules: [
        { points: [{ x: 100, y: 100 }], minDistance: 120 },
        { points: [{ x: 1000, y: 1000 }], minDistance: 250 },
      ],
    })

    expect(captures.insertedInventoryValues).toEqual(
      startupResources.map((resource) => ({
        stationId: 'st-new',
        resourceKey: resource.resource_key,
        amount: String(resource.amount),
      })),
    )
  })

  it('logs warning when station spawn falls back to unconstrained location', async () => {
    const { db } = createFakeDb({
      stationPoints: [],
      asteroidPoints: [],
      insertedStationId: 'st-fallback',
    })

    vi.mocked(findPointWithFallback).mockReturnValue({
      point: { x: 42, y: 24 },
      usedFallback: true,
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await createStationForPlayer(
      { db } as unknown as Parameters<typeof createStationForPlayer>[0],
      'player-2',
    )

    expect(warnSpy).toHaveBeenCalledWith(
      'station_spawn_fallback playerId=player-2 maxAttempts=5000 x=42 y=24',
    )

    warnSpy.mockRestore()
  })

  it('returns existing station id when insert conflicts and skips startup inventory insert', async () => {
    const { db, captures } = createFakeDb({
      stationPoints: [],
      asteroidPoints: [],
      insertedStationId: null,
      existingStationId: 'st-existing',
    })

    vi.mocked(findPointWithFallback).mockReturnValue({
      point: { x: 555, y: 777 },
      usedFallback: false,
    })

    const stationId = await createStationForPlayer(
      { db } as unknown as Parameters<typeof createStationForPlayer>[0],
      'player-3',
    )

    expect(stationId).toBe('st-existing')
    expect(captures.insertedInventoryValues).toBeNull()
  })
})
