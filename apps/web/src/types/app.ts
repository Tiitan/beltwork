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

/**
 * Supported account session modes.
 */
export type SessionType = 'guest' | 'local'

/**
 * Persisted player profile and auth payload.
 */
export type Profile = {
  authType: SessionType
  displayName: string
  email: string
  password: string
}

/**
 * Editable account settings bound to station forms.
 */
export type SettingsForm = {
  displayName: string
  email: string
  password: string
}
