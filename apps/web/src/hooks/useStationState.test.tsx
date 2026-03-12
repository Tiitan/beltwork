import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createStationBuilding,
  fetchMapSnapshot,
  fetchStationSnapshot,
  recallMiningOperation,
  startMiningOperation,
  upgradeStationBuilding,
} from '../features/station/api'
import { useStationState } from './useStationState'

vi.mock('../features/station/api', () => ({
  createStationBuilding: vi.fn(),
  fetchMapSnapshot: vi.fn(),
  fetchStationSnapshot: vi.fn(),
  startMiningOperation: vi.fn(),
  recallMiningOperation: vi.fn(),
  upgradeStationBuilding: vi.fn(),
}))

describe('useStationState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('refreshes station snapshot at upgrade finish time', async () => {
    const now = new Date('2026-03-11T18:30:00.000Z')
    vi.setSystemTime(now)

    vi.mocked(fetchMapSnapshot).mockResolvedValue({
      worldBounds: { minX: 0, maxX: 10000, minY: 0, maxY: 10000 },
      stations: [],
      asteroids: [],
    })

    vi.mocked(fetchStationSnapshot)
      .mockResolvedValueOnce({
        id: 'station-1',
        x: 100,
        y: 200,
        inventory: [],
        buildings: [
          {
            id: 'building-1',
            type: 'storage',
            level: 1,
            status: 'upgrading',
            upgradeFinishAt: new Date(now.getTime() + 1_000).toISOString(),
            slotIndex: 2,
          },
        ],
        buildableBuildings: [],
        miningRigCapacity: 1,
        activeMiningOperations: [],
      })
      .mockResolvedValueOnce({
        id: 'station-1',
        x: 100,
        y: 200,
        inventory: [],
        buildings: [
          {
            id: 'building-1',
            type: 'storage',
            level: 2,
            status: 'idle',
            upgradeFinishAt: null,
            slotIndex: 2,
          },
        ],
        buildableBuildings: [],
        miningRigCapacity: 1,
        activeMiningOperations: [],
      })

    vi.mocked(createStationBuilding).mockResolvedValue({
      id: 'station-1',
      x: 100,
      y: 200,
      inventory: [],
      buildings: [],
      buildableBuildings: [],
      miningRigCapacity: 1,
      activeMiningOperations: [],
    })
    vi.mocked(upgradeStationBuilding).mockResolvedValue({
      id: 'station-1',
      x: 100,
      y: 200,
      inventory: [],
      buildings: [],
      buildableBuildings: [],
      miningRigCapacity: 1,
      activeMiningOperations: [],
    })
    vi.mocked(startMiningOperation).mockResolvedValue({
      id: 'station-1',
      x: 100,
      y: 200,
      inventory: [],
      buildings: [],
      buildableBuildings: [],
      miningRigCapacity: 1,
      activeMiningOperations: [],
    })
    vi.mocked(recallMiningOperation).mockResolvedValue({
      id: 'station-1',
      x: 100,
      y: 200,
      inventory: [],
      buildings: [],
      buildableBuildings: [],
      miningRigCapacity: 1,
      activeMiningOperations: [],
    })

    const { result } = renderHook(() => useStationState())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.buildings[0]?.status).toBe('upgrading')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.buildings[0]?.status).toBe('idle')
    expect(vi.mocked(fetchStationSnapshot)).toHaveBeenCalledTimes(2)
  })
})
