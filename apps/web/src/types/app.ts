export type InventoryRow = {
  resourceKey: string
  amount: number
}

export type BuildingRow = {
  type: string
  level: number
  status: 'idle' | 'upgrading'
}

export type AsteroidRow = {
  id: string
  templateId: string
  distanceFromStation: number
  remainingUnits: number
  isDepleted: boolean
}

export type SessionType = 'guest' | 'local'

export type Profile = {
  authType: SessionType
  displayName: string
  email: string
  password: string
}

export type SettingsForm = {
  displayName: string
  email: string
  password: string
}
