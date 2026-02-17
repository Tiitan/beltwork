import { useMemo, useState } from 'react'
import type { AsteroidRow, BuildingRow, InventoryRow } from '../types/app'

const initialInventory: InventoryRow[] = [
  { resourceKey: 'res_metals', amount: 120 },
  { resourceKey: 'res_carbon', amount: 45 },
  { resourceKey: 'cmp_metal_plates', amount: 12 },
]

const initialBuildings: BuildingRow[] = [
  { type: 'fusion_reactor', level: 1, status: 'idle' },
  { type: 'refinery', level: 1, status: 'upgrading' },
  { type: 'assembler', level: 1, status: 'idle' },
]

const discoveredAsteroids: AsteroidRow[] = [
  {
    id: 'ast-101',
    templateId: 'ast_common_chondrite',
    distanceFromStation: 18,
    remainingUnits: 950,
    isDepleted: false,
  },
  {
    id: 'ast-202',
    templateId: 'ast_metal_rich',
    distanceFromStation: 41,
    remainingUnits: 510,
    isDepleted: false,
  },
]

export function useStationState() {
  const [selectedAsteroidId, setSelectedAsteroidId] = useState(discoveredAsteroids[0]?.id ?? '')
  const [selectedRecipeKey, setSelectedRecipeKey] = useState('rcp_refine_metal_plates')
  const [inventory] = useState(initialInventory)
  const [buildings] = useState(initialBuildings)

  const selectedAsteroid = useMemo(
    () => discoveredAsteroids.find((asteroid) => asteroid.id === selectedAsteroidId),
    [selectedAsteroidId],
  )

  return {
    inventory,
    buildings,
    discoveredAsteroids,
    selectedAsteroid,
    selectedAsteroidId,
    selectedRecipeKey,
    setSelectedAsteroidId,
    setSelectedRecipeKey,
  }
}
