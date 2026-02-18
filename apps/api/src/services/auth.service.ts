import { and, eq } from 'drizzle-orm'
import { playerIdentities, players } from '../db/schema.js'
import type {
  AppServices,
  AuthProfile,
  GoogleIdentityClaims,
  ResolvedAuthSession,
} from '../types/api.js'
import { parseCookies, decodeAndVerifySignedSessionCookieValue } from '../utils/cookies.js'
import { findActiveSessionByToken, touchSessionLastSeen } from './session.service.js'

const GOOGLE_PROVIDER = 'google'

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function buildGuestDisplayName(): string {
  const suffix = Math.floor(Math.random() * 9000) + 1000
  return `Calm Prospector ${suffix}`
}

export async function resolveAuth(
  services: AppServices,
  request: any,
): Promise<ResolvedAuthSession | null> {
  const cookies = parseCookies(request.headers.cookie)
  const signedCookieValue = cookies[services.env.SESSION_COOKIE_NAME]
  const sessionToken = decodeAndVerifySignedSessionCookieValue(
    signedCookieValue,
    services.env.SESSION_COOKIE_SECRET,
  )
  if (!sessionToken) {
    return null
  }

  const sessionRow = await findActiveSessionByToken(services, sessionToken)
  if (!sessionRow) {
    return null
  }

  await touchSessionLastSeen(services, sessionRow.sessionId)
  return sessionRow
}

export async function loadAuthProfile(
  services: AppServices,
  playerId: string,
): Promise<AuthProfile | null> {
  const [player] = await services.db
    .select({
      id: players.id,
      display_name: players.displayName,
      auth_type: players.authType,
      email: players.email,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1)

  if (!player) {
    return null
  }

  const [googleIdentity] = await services.db
    .select({
      providerUserId: playerIdentities.providerUserId,
      email: playerIdentities.email,
    })
    .from(playerIdentities)
    .where(
      and(eq(playerIdentities.playerId, playerId), eq(playerIdentities.provider, GOOGLE_PROVIDER)),
    )
    .limit(1)

  return {
    ...player,
    email: player.email ?? '',
    google_linked: Boolean(googleIdentity?.providerUserId),
    google_linked_email: googleIdentity?.email ?? '',
  }
}

export async function createGuestPlayer(services: AppServices) {
  const [player] = await services.db
    .insert(players)
    .values({
      displayName: buildGuestDisplayName(),
      authType: 'guest',
    })
    .returning({
      id: players.id,
      display_name: players.displayName,
      auth_type: players.authType,
      email: players.email,
    })

  return player
}

export async function findPlayerByEmail(services: AppServices, email: string) {
  const [player] = await services.db
    .select({
      id: players.id,
      display_name: players.displayName,
      auth_type: players.authType,
      email: players.email,
      password_hash: players.passwordHash,
    })
    .from(players)
    .where(eq(players.email, email))
    .limit(1)

  return player ?? null
}

export async function resolvePlayerForGoogleSignIn(
  services: AppServices,
  claims: GoogleIdentityClaims,
): Promise<{ playerId: string; isNewPlayer: boolean }> {
  const [existingIdentity] = await services.db
    .select({
      playerId: playerIdentities.playerId,
    })
    .from(playerIdentities)
    .where(
      and(
        eq(playerIdentities.provider, GOOGLE_PROVIDER),
        eq(playerIdentities.providerUserId, claims.sub),
      ),
    )
    .limit(1)

  let playerId = existingIdentity?.playerId
  let isNewPlayer = false

  if (!playerId) {
    const [emailPlayer] = await services.db
      .select({
        id: players.id,
      })
      .from(players)
      .where(eq(players.email, claims.email))
      .limit(1)

    if (emailPlayer) {
      playerId = emailPlayer.id
    } else {
      const [createdPlayer] = await services.db
        .insert(players)
        .values({
          displayName: claims.name,
          email: claims.email,
          authType: 'google',
        })
        .returning({
          id: players.id,
        })

      playerId = createdPlayer.id
      isNewPlayer = true
    }

    try {
      await services.db.insert(playerIdentities).values({
        playerId,
        provider: GOOGLE_PROVIDER,
        providerUserId: claims.sub,
        email: claims.email,
      })
    } catch (error: any) {
      if (error?.code === '23505') {
        const [linkedIdentity] = await services.db
          .select({
            playerId: playerIdentities.playerId,
          })
          .from(playerIdentities)
          .where(
            and(
              eq(playerIdentities.provider, GOOGLE_PROVIDER),
              eq(playerIdentities.providerUserId, claims.sub),
            ),
          )
          .limit(1)

        if (!linkedIdentity) {
          throw error
        }

        playerId = linkedIdentity.playerId
        isNewPlayer = false
      } else {
        throw error
      }
    }
  }

  return { playerId, isNewPlayer }
}

export async function linkGoogleIdentityToPlayer(
  services: AppServices,
  playerId: string,
  claims: GoogleIdentityClaims,
): Promise<'linked' | 'already_linked' | 'in_use'> {
  const [existingIdentity] = await services.db
    .select({
      playerId: playerIdentities.playerId,
    })
    .from(playerIdentities)
    .where(
      and(
        eq(playerIdentities.provider, GOOGLE_PROVIDER),
        eq(playerIdentities.providerUserId, claims.sub),
      ),
    )
    .limit(1)

  if (existingIdentity && existingIdentity.playerId !== playerId) {
    return 'in_use'
  }

  if (existingIdentity) {
    return 'already_linked'
  }

  try {
    await services.db.insert(playerIdentities).values({
      playerId,
      provider: GOOGLE_PROVIDER,
      providerUserId: claims.sub,
      email: claims.email,
    })
  } catch (error: any) {
    if (error?.code === '23505') {
      return 'in_use'
    }
    throw error
  }

  return 'linked'
}
