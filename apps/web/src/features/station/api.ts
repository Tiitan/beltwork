import type {
  ActiveMiningOperationRow,
  BuildableBuildingRow,
  BuildingRow,
  InventoryRow,
  MapSnapshot,
} from '../../types/app'

type StationSnapshotResponse = {
  id: string
  x: number
  y: number
  inventory: Array<{
    resource_key: string
    amount: number
  }>
  buildings: Array<{
    id: string
    building_type: string
    level: number
    status: 'idle' | 'upgrading'
    upgrade_finish_at: string | null
    slot_index: number
  }>
  buildable_buildings: Array<{
    id: string
    name: string
  }>
  mining_rig_capacity: number
  active_mining_operations: Array<{
    id: string
    asteroid_id: string
    status: 'flying_to_destination' | 'mining' | 'returning'
    phase_started_at: string
    phase_finish_at: string | null
    return_origin_progress?: number | null
    quantity: number
    quantity_target: number
    cargo_capacity: number
    estimated_asteroid_remaining_units: number | null
    asteroid_remaining_units_at_mining_start: number | null
  }>
}

export type StationSnapshot = {
  id: string
  x: number
  y: number
  inventory: InventoryRow[]
  buildings: BuildingRow[]
  buildableBuildings: BuildableBuildingRow[]
  miningRigCapacity: number
  activeMiningOperations: ActiveMiningOperationRow[]
}

type MapSnapshotResponse = {
  world_bounds: {
    min_x: number
    max_x: number
    min_y: number
    max_y: number
  }
  stations: Array<{
    id: string
    name: string
    x: number
    y: number
  }>
  asteroids: Array<{
    id: string
    x: number
    y: number
    is_scanned: boolean
    name?: string
    yield_multiplier?: number
    composition?: Record<string, number>
    template_id?: string
    scanned_remaining_units?: number
    scanned_at?: string
  }>
}

function parseStationSnapshotResponse(payload: StationSnapshotResponse): StationSnapshot {
  return {
    id: payload.id,
    x: payload.x,
    y: payload.y,
    inventory: payload.inventory.map((item) => ({
      resourceKey: item.resource_key,
      amount: item.amount,
    })),
    buildings: payload.buildings.map((building) => ({
      id: building.id,
      type: building.building_type,
      level: building.level,
      status: building.status,
      upgradeFinishAt: building.upgrade_finish_at,
      slotIndex: building.slot_index,
    })),
    buildableBuildings: payload.buildable_buildings.map((building) => ({
      id: building.id,
      name: building.name,
    })),
    miningRigCapacity: payload.mining_rig_capacity ?? 0,
    activeMiningOperations: (payload.active_mining_operations ?? []).map((operation) => ({
      id: operation.id,
      asteroidId: operation.asteroid_id,
      status: operation.status,
      phaseStartedAt: operation.phase_started_at,
      phaseFinishAt: operation.phase_finish_at,
      returnOriginProgress: operation.return_origin_progress ?? null,
      quantity: operation.quantity,
      quantityTarget: operation.quantity_target,
      cargoCapacity: operation.cargo_capacity,
      estimatedAsteroidRemainingUnits: operation.estimated_asteroid_remaining_units,
      asteroidRemainingUnitsAtMiningStart: operation.asteroid_remaining_units_at_mining_start,
    })),
  }
}

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (typeof init.body !== 'undefined' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  return fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })
}

export async function fetchStationSnapshot(): Promise<StationSnapshot> {
  const response = await apiFetch('/v1/station', { method: 'GET' })
  if (!response.ok) {
    throw new Error('failed_to_fetch_station')
  }

  const payload = (await response.json()) as StationSnapshotResponse
  return parseStationSnapshotResponse(payload)
}

export async function fetchStationInventory(): Promise<InventoryRow[]> {
  const snapshot = await fetchStationSnapshot()
  return snapshot.inventory
}

export async function createStationBuilding(
  buildingType: string,
  slotIndex: number,
): Promise<StationSnapshot> {
  const response = await apiFetch('/v1/station/buildings', {
    method: 'POST',
    body: JSON.stringify({
      building_type: buildingType,
      slot_index: slotIndex,
    }),
  })

  if (!response.ok) {
    throw new Error('failed_to_create_building')
  }

  const payload = (await response.json()) as StationSnapshotResponse
  return parseStationSnapshotResponse(payload)
}

export async function upgradeStationBuilding(buildingId: string): Promise<StationSnapshot> {
  const response = await apiFetch(`/v1/station/buildings/${buildingId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      action: 'upgrade',
    }),
  })

  if (!response.ok) {
    throw new Error('failed_to_upgrade_building')
  }

  const payload = (await response.json()) as StationSnapshotResponse
  return parseStationSnapshotResponse(payload)
}

export async function startMiningOperation(asteroidId: string): Promise<StationSnapshot> {
  const response = await apiFetch('/v1/mining/operations', {
    method: 'POST',
    body: JSON.stringify({
      asteroid_id: asteroidId,
    }),
  })

  if (!response.ok) {
    throw new Error('failed_to_start_mining_operation')
  }

  const payload = (await response.json()) as StationSnapshotResponse
  return parseStationSnapshotResponse(payload)
}

export async function recallMiningOperation(operationId: string): Promise<StationSnapshot> {
  const response = await apiFetch(`/v1/mining/operations/${operationId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      action: 'recall',
    }),
  })

  if (!response.ok) {
    throw new Error('failed_to_recall_mining_operation')
  }

  const payload = (await response.json()) as StationSnapshotResponse
  return parseStationSnapshotResponse(payload)
}

export async function fetchMapSnapshot(): Promise<MapSnapshot> {
  const response = await apiFetch('/v1/map', { method: 'GET' })
  if (!response.ok) {
    throw new Error('failed_to_fetch_map')
  }

  const payload = (await response.json()) as MapSnapshotResponse
  return {
    worldBounds: {
      minX: payload.world_bounds.min_x,
      maxX: payload.world_bounds.max_x,
      minY: payload.world_bounds.min_y,
      maxY: payload.world_bounds.max_y,
    },
    stations: payload.stations.map((station) => ({
      id: station.id,
      name: station.name,
      x: station.x,
      y: station.y,
    })),
    asteroids: payload.asteroids.map((asteroid) => ({
      id: asteroid.id,
      x: asteroid.x,
      y: asteroid.y,
      isScanned: asteroid.is_scanned,
      name: asteroid.name,
      yieldMultiplier: asteroid.yield_multiplier,
      composition: asteroid.composition,
      templateId: asteroid.template_id,
      scannedRemainingUnits: asteroid.scanned_remaining_units,
      scannedAt: asteroid.scanned_at,
    })),
  }
}

export async function scanAsteroid(asteroidId: string): Promise<void> {
  const response = await apiFetch(`/v1/asteroids/${asteroidId}/scan`, { method: 'POST' })
  if (!response.ok) {
    throw new Error('failed_to_scan_asteroid')
  }
}
