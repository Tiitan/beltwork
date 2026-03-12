import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createStationBuilding,
  fetchMapSnapshot,
  recallMiningOperation,
  fetchStationSnapshot,
  startMiningOperation,
  upgradeStationBuilding,
} from '../features/station/api'
import type {
  ActiveMiningOperationRow,
  BuildableBuildingRow,
  BuildingRow,
  InventoryRow,
  MapElement,
  MapElementRef,
  MapSnapshot,
} from '../types/app'

const defaultWorldBounds = {
  minX: 0,
  maxX: 10000,
  minY: 0,
  maxY: 10000,
} as const
const STATION_UPGRADE_OVERDUE_REFRESH_RETRY_MS = 1_000
const STATION_LIVE_PROGRESS_TICK_MS = 250

/**
 * Manages station dashboard state and derived selections.
 *
 * @returns Station collections, selected entities, and update handlers.
 */
export function useStationState() {
  const [selectedElementRef, setSelectedElementRef] = useState<MapElementRef | null>(null)
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [playerStation, setPlayerStation] = useState<{ id: string; x: number; y: number } | null>(
    null,
  )
  const [buildings, setBuildings] = useState<BuildingRow[]>([])
  const [buildableBuildings, setBuildableBuildings] = useState<BuildableBuildingRow[]>([])
  const [miningRigCapacity, setMiningRigCapacity] = useState(0)
  const [activeMiningOperations, setActiveMiningOperations] = useState<ActiveMiningOperationRow[]>(
    [],
  )
  const [uiNowMs, setUiNowMs] = useState(() => Date.now())
  const [mapSnapshot, setMapSnapshot] = useState<MapSnapshot>({
    worldBounds: defaultWorldBounds,
    stations: [],
    asteroids: [],
  })
  const [inventoryError, setInventoryError] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isMapLoading, setIsMapLoading] = useState(true)
  const [isStationActionPending, setIsStationActionPending] = useState(false)

  const mapEntities = useMemo<MapElement[]>(
    () => [
      ...mapSnapshot.stations.map((station) => ({ type: 'station' as const, data: station })),
      ...mapSnapshot.asteroids.map((asteroid) => ({ type: 'asteroid' as const, data: asteroid })),
    ],
    [mapSnapshot.asteroids, mapSnapshot.stations],
  )

  const selectedElement = useMemo<MapElement | null>(() => {
    if (!selectedElementRef) {
      return null
    }

    return (
      mapEntities.find(
        (entity) =>
          entity.type === selectedElementRef.type && entity.data.id === selectedElementRef.id,
      ) ?? null
    )
  }, [mapEntities, selectedElementRef])

  function clearSelectedElement() {
    setSelectedElementRef(null)
  }

  const refreshMapSnapshot = useCallback(async () => {
    const nextMapSnapshot = await fetchMapSnapshot()
    setMapSnapshot(nextMapSnapshot)
    setSelectedElementRef((previous) => {
      if (!previous) {
        return null
      }
      if (previous.type === 'asteroid') {
        return nextMapSnapshot.asteroids.some((asteroid) => asteroid.id === previous.id)
          ? previous
          : null
      }
      return nextMapSnapshot.stations.some((station) => station.id === previous.id)
        ? previous
        : null
    })
  }, [])

  const applyStationSnapshot = useCallback(
    (stationSnapshot: Awaited<ReturnType<typeof fetchStationSnapshot>>) => {
      setInventory(stationSnapshot.inventory)
      setPlayerStation({
        id: stationSnapshot.id,
        x: stationSnapshot.x,
        y: stationSnapshot.y,
      })
      setBuildings(stationSnapshot.buildings)
      setBuildableBuildings(stationSnapshot.buildableBuildings)
      setMiningRigCapacity(stationSnapshot.miningRigCapacity)
      setActiveMiningOperations(stationSnapshot.activeMiningOperations)
      setInventoryError(null)
    },
    [],
  )

  const refreshStationSnapshot = useCallback(async () => {
    const stationSnapshot = await fetchStationSnapshot()
    applyStationSnapshot(stationSnapshot)
  }, [applyStationSnapshot])

  const buildBuildingInSlot = useCallback(
    async (slotIndex: number, buildingType: string) => {
      setIsStationActionPending(true)
      try {
        const stationSnapshot = await createStationBuilding(buildingType, slotIndex)
        applyStationSnapshot(stationSnapshot)
      } finally {
        setIsStationActionPending(false)
      }
    },
    [applyStationSnapshot],
  )

  const upgradeBuildingById = useCallback(
    async (buildingId: string) => {
      setIsStationActionPending(true)
      try {
        const stationSnapshot = await upgradeStationBuilding(buildingId)
        applyStationSnapshot(stationSnapshot)
      } finally {
        setIsStationActionPending(false)
      }
    },
    [applyStationSnapshot],
  )

  const deployMiningRigToAsteroid = useCallback(
    async (asteroidId: string) => {
      setIsStationActionPending(true)
      try {
        const stationSnapshot = await startMiningOperation(asteroidId)
        applyStationSnapshot(stationSnapshot)
      } finally {
        setIsStationActionPending(false)
      }
    },
    [applyStationSnapshot],
  )

  const recallMiningOperationById = useCallback(
    async (operationId: string) => {
      setIsStationActionPending(true)
      try {
        const stationSnapshot = await recallMiningOperation(operationId)
        applyStationSnapshot(stationSnapshot)
      } finally {
        setIsStationActionPending(false)
      }
    },
    [applyStationSnapshot],
  )

  useEffect(() => {
    const upgradingFinishTimes = buildings
      .filter((building) => building.status === 'upgrading' && building.upgradeFinishAt !== null)
      .map((building) => Date.parse(building.upgradeFinishAt as string))
      .filter((value) => Number.isFinite(value))
    const miningFinishTimes = activeMiningOperations
      .map((operation) =>
        operation.phaseFinishAt ? Date.parse(operation.phaseFinishAt) : Number.NaN,
      )
      .filter((value) => Number.isFinite(value))
    const refreshAtTimes = [...upgradingFinishTimes, ...miningFinishTimes]

    if (refreshAtTimes.length === 0) {
      return
    }

    const earliestFinishAtMs = Math.min(...refreshAtTimes)
    const initialDelayMs = Math.max(0, earliestFinishAtMs - Date.now())
    let isCancelled = false
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined

    const refreshSnapshots = async () => {
      try {
        await Promise.all([refreshStationSnapshot(), refreshMapSnapshot()])
      } catch {
        return
      }
    }

    const scheduleRetry = () => {
      timeoutHandle = setTimeout(async () => {
        await refreshSnapshots()

        if (!isCancelled) {
          scheduleRetry()
        }
      }, STATION_UPGRADE_OVERDUE_REFRESH_RETRY_MS)
    }

    timeoutHandle = setTimeout(async () => {
      await refreshSnapshots()

      if (!isCancelled) {
        scheduleRetry()
      }
    }, initialDelayMs)

    return () => {
      isCancelled = true
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
    }
  }, [activeMiningOperations, buildings, refreshMapSnapshot, refreshStationSnapshot])

  useEffect(() => {
    setUiNowMs(Date.now())
    const hasLiveOperations = activeMiningOperations.some(
      (operation) =>
        operation.status === 'flying_to_destination' ||
        operation.status === 'mining' ||
        operation.status === 'returning',
    )

    if (!hasLiveOperations) {
      return
    }

    const timer = setInterval(() => {
      setUiNowMs(Date.now())
    }, STATION_LIVE_PROGRESS_TICK_MS)

    return () => {
      clearInterval(timer)
    }
  }, [activeMiningOperations])

  useEffect(() => {
    let isMounted = true

    async function loadStationSnapshot() {
      try {
        const stationSnapshot = await fetchStationSnapshot()
        if (!isMounted) {
          return
        }

        applyStationSnapshot(stationSnapshot)
      } catch {
        if (!isMounted) {
          return
        }

        setInventory([])
        setBuildings([])
        setBuildableBuildings([])
        setMiningRigCapacity(0)
        setActiveMiningOperations([])
        setPlayerStation(null)
        setInventoryError('unavailable')
      }
    }

    void loadStationSnapshot()

    return () => {
      isMounted = false
    }
  }, [applyStationSnapshot])

  useEffect(() => {
    let isMounted = true

    async function loadMapSnapshot() {
      try {
        const nextMapSnapshot = await fetchMapSnapshot()
        if (!isMounted) {
          return
        }

        setMapSnapshot(nextMapSnapshot)
        setSelectedElementRef((previous) => {
          if (!previous) {
            return null
          }
          if (previous.type === 'asteroid') {
            return nextMapSnapshot.asteroids.some((asteroid) => asteroid.id === previous.id)
              ? previous
              : null
          }
          return nextMapSnapshot.stations.some((station) => station.id === previous.id)
            ? previous
            : null
        })
        setMapError(null)
      } catch {
        if (!isMounted) {
          return
        }

        setMapSnapshot({ worldBounds: defaultWorldBounds, stations: [], asteroids: [] })
        setSelectedElementRef(null)
        setMapError('unavailable')
      } finally {
        if (isMounted) {
          setIsMapLoading(false)
        }
      }
    }

    void loadMapSnapshot()

    return () => {
      isMounted = false
    }
  }, [refreshMapSnapshot])

  return {
    inventory,
    inventoryError,
    mapSnapshot,
    mapError,
    isMapLoading,
    playerStation,
    playerAnchor: playerStation,
    mapEntities,
    buildings,
    buildableBuildings,
    miningRigCapacity,
    activeMiningOperations,
    uiNowMs,
    isStationActionPending,
    isBuildingPending: isStationActionPending,
    selectedElement,
    selectedElementRef,
    setSelectedElementRef,
    clearSelectedElement,
    refreshMapSnapshot,
    refreshStationSnapshot,
    buildBuildingInSlot,
    upgradeBuildingById,
    deployMiningRigToAsteroid,
    recallMiningOperationById,
  }
}
