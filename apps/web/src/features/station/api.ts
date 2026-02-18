import type { InventoryRow } from '../../types/app'

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

export async function fetchStationInventory(): Promise<InventoryRow[]> {
  const response = await apiFetch('/v1/station', { method: 'GET' })
  if (!response.ok) {
    throw new Error('failed_to_fetch_station')
  }

  const payload = (await response.json()) as StationSnapshotResponse
  return payload.inventory.map((item) => ({
    resourceKey: item.resource_key,
    amount: item.amount,
  }))
}
