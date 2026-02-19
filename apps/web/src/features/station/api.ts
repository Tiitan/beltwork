import type { InventoryRow, MapSnapshot } from '../../types/app'

type StationSnapshotResponse = {
  station: {
    id: string
    x: number
    y: number
  }
  inventory: Array<{
    resource_key: string
    amount: number
  }>
}

export type StationSnapshot = {
  station: {
    id: string
    x: number
    y: number
  }
  inventory: InventoryRow[]
}

type MapSnapshotResponse = {
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
  return {
    station: {
      id: payload.station.id,
      x: payload.station.x,
      y: payload.station.y,
    },
    inventory: payload.inventory.map((item) => ({
      resourceKey: item.resource_key,
      amount: item.amount,
    })),
  }
}

export async function fetchStationInventory(): Promise<InventoryRow[]> {
  const snapshot = await fetchStationSnapshot()
  return snapshot.inventory
}

export async function fetchMapSnapshot(): Promise<MapSnapshot> {
  const response = await apiFetch('/v1/map', { method: 'GET' })
  if (!response.ok) {
    throw new Error('failed_to_fetch_map')
  }

  const payload = (await response.json()) as MapSnapshotResponse
  return {
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
