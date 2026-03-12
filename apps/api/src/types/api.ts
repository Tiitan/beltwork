import type { FactoryJob } from '../factory-jobs/service.js'
import type { db } from '../db/client.js'
import type { env } from '../config.js'
import type { DomainEventHandlerRegistry } from '../services/domain-events/types.js'

export type GoogleIdentityClaims = {
  sub: string
  email: string
  name: string
  emailVerified: boolean
}

export type VerifyGoogleIdToken = (idToken: string) => Promise<GoogleIdentityClaims>

/**
 * Optional server dependency overrides for tests and local harnesses.
 */
export type BuildServerOptions = {
  checkReadiness?: () => Promise<void>
  verifyGoogleIdToken?: VerifyGoogleIdToken
}

export type AuthProfile = {
  id: string
  display_name: string
  auth_type: 'guest' | 'local' | 'google'
  email: string
  google_linked: boolean
  google_linked_email: string
}

export type StationSnapshotResponse = {
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
    return_origin_progress: number | null
    quantity: number
    quantity_target: number
    cargo_capacity: number
    estimated_asteroid_remaining_units: number | null
    asteroid_remaining_units_at_mining_start: number | null
  }>
}

export type JournalEventResponse = {
  id: string
  event_type: string
  importance: 'info' | 'important' | 'warning'
  description: string
  occurred_at: string
}

export type JournalEventsResponse = {
  events: JournalEventResponse[]
  next_cursor: string | null
}

export type MapStationResponse = {
  id: string
  x: number
  y: number
  name: string
}

export type MapAsteroidResponse = {
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
}

export type MapSnapshotResponse = {
  world_bounds: {
    min_x: number
    max_x: number
    min_y: number
    max_y: number
  }
  stations: MapStationResponse[]
  asteroids: MapAsteroidResponse[]
}

export type ResolvedAuthSession = {
  sessionId: string
  playerId: string
}

export type AppServices = {
  db: typeof db
  env: typeof env
  checkReadiness: () => Promise<void>
  verifyGoogleIdToken: VerifyGoogleIdToken
  factoryJobs: Map<string, FactoryJob>
  domainEventHandlers?: DomainEventHandlerRegistry<AppServices>
}
