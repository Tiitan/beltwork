import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createStationBuilding,
  fetchMapSnapshot,
  fetchStationSnapshot,
  upgradeStationBuilding,
} from '../features/station/api'
import type {
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
  }
}
