import type { FactoryJob } from '../factory-jobs/service.js'
import type { db } from '../db/client.js'
import type { env } from '../config.js'

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
}
