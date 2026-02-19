import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchMapSnapshot, fetchStationSnapshot } from '../features/station/api'
import type { BuildingRow, InventoryRow, MapSelection, MapSnapshot } from '../types/app'

/**
 * Initial building snapshot used by the station screen.
 */
const initialBuildings: BuildingRow[] = [
  { type: 'fusion_reactor', level: 1, status: 'idle' },
  { type: 'refinery', level: 1, status: 'upgrading' },
  { type: 'assembler', level: 1, status: 'idle' },
]

/**
 * Manages station dashboard state and derived selections.
 *
 * @returns Station collections, selected entities, and update handlers.
 */
export function useStationState() {
  const [selectedMapItem, setSelectedMapItem] = useState<MapSelection | null>(null)
  const [selectedRecipeKey, setSelectedRecipeKey] = useState('rcp_refine_metal_plates')
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [playerStation, setPlayerStation] = useState<{ id: string; x: number; y: number } | null>(
    null,
  )
  const [mapSnapshot, setMapSnapshot] = useState<MapSnapshot>({ stations: [], asteroids: [] })
  const [buildings] = useState(initialBuildings)
  const [inventoryError, setInventoryError] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isMapLoading, setIsMapLoading] = useState(true)

  const selectedStation = useMemo(
    () =>
      selectedMapItem?.type === 'station'
        ? (mapSnapshot.stations.find((station) => station.id === selectedMapItem.id) ?? null)
        : null,
    [mapSnapshot.stations, selectedMapItem],
  )

  const selectedAsteroid = useMemo(
    () =>
      selectedMapItem?.type === 'asteroid'
        ? (mapSnapshot.asteroids.find((asteroid) => asteroid.id === selectedMapItem.id) ?? null)
        : null,
    [mapSnapshot.asteroids, selectedMapItem],
  )

  function clearSelectedMapItem() {
    setSelectedMapItem(null)
  }

  const refreshMapSnapshot = useCallback(async () => {
    const nextMapSnapshot = await fetchMapSnapshot()
    setMapSnapshot(nextMapSnapshot)
    setSelectedMapItem((previous) => {
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

  useEffect(() => {
    let isMounted = true

    async function loadStationInventory() {
      try {
        const stationSnapshot = await fetchStationSnapshot()
        if (!isMounted) {
          return
        }

        setInventory(stationSnapshot.inventory)
        setPlayerStation(stationSnapshot.station)
        setInventoryError(null)
      } catch {
        if (!isMounted) {
          return
        }

        setInventory([])
        setPlayerStation(null)
        setInventoryError('unavailable')
      }
    }

    void loadStationInventory()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadMapSnapshot() {
      try {
        const nextMapSnapshot = await fetchMapSnapshot()
        if (!isMounted) {
          return
        }

        setMapSnapshot(nextMapSnapshot)
        setSelectedMapItem((previous) => {
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

        setMapSnapshot({ stations: [], asteroids: [] })
        setSelectedMapItem(null)
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
    buildings,
    selectedStation,
    selectedAsteroid,
    selectedMapItem,
    selectedRecipeKey,
    setSelectedMapItem,
    clearSelectedMapItem,
    refreshMapSnapshot,
    setSelectedRecipeKey,
  }
}
