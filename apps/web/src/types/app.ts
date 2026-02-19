/**
 * Inventory row shown in the station resource panel.
 */
export type InventoryRow = {
  resourceKey: string
  amount: number
}

/**
 * Building status row for station operations.
 */
export type BuildingRow = {
  type: string
  level: number
  status: 'idle' | 'upgrading'
}

/**
 * Asteroid entry available for mining selection.
 */
export type AsteroidRow = {
  id: string
  templateId: string
  distanceFromStation: number
  remainingUnits: number
  isDepleted: boolean
}

export type MapStation = {
  id: string
  name: string
  x: number
  y: number
}

export type MapAsteroid = {
  id: string
  x: number
  y: number
  isScanned: boolean
  name?: string
  yieldMultiplier?: number
  composition?: Record<string, number>
  templateId?: string
  scannedRemainingUnits?: number
  scannedAt?: string
}

export type MapSnapshot = {
  stations: MapStation[]
  asteroids: MapAsteroid[]
}

export type MapElementType = 'station' | 'asteroid'

export type MapElementRef = {
  type: MapElementType
  id: string
}

export type MapElement =
  | {
      type: 'station'
      data: MapStation
    }
  | {
      type: 'asteroid'
      data: MapAsteroid
    }

export type MapSelection = MapElementRef

export type MapCoordinates = {
  x: number
  y: number
}

export type MapPanelContext = {
  onClose: () => void
}

/**
 * Supported account session modes.
 */
export type SessionType = 'guest' | 'local' | 'google'

/**
 * Persisted player profile and auth payload.
 */
export type Profile = {
  id: string
  authType: SessionType
  displayName: string
  email: string
  googleLinked: boolean
  googleLinkedEmail: string
}

/**
 * Editable account settings bound to station forms.
 */
export type SettingsForm = {
  displayName: string
  email: string
  password: string
}
