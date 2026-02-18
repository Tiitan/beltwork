import { gt, and, eq, isNull } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { sessions, players } from '../db/schema.js'
import type { AppServices } from '../types/api.js'

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

export async function createSessionForPlayer(
  services: AppServices,
  playerId: string,
): Promise<string> {
  const sessionToken = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await services.db.insert(sessions).values({
    playerId,
    sessionToken,
    expiresAt,
  })

  return sessionToken
}

export async function findActiveSessionByToken(services: AppServices, sessionToken: string) {
  const [sessionRow] = await services.db
    .select({
      sessionId: sessions.id,
      playerId: sessions.playerId,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.sessionToken, sessionToken),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1)

  return sessionRow ?? null
}

export async function touchSessionLastSeen(
  services: AppServices,
  sessionId: string,
): Promise<void> {
  await services.db
    .update(sessions)
    .set({
      lastSeenAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
}

export async function revokeSessionAndDeleteEphemeralGuestIfNeeded(
  services: AppServices,
  sessionToken: string,
): Promise<void> {
  const [sessionRow] = await services.db
    .select({
      id: sessions.id,
      playerId: sessions.playerId,
    })
    .from(sessions)
    .where(eq(sessions.sessionToken, sessionToken))
    .limit(1)

  if (!sessionRow) {
    return
  }

  await services.db
    .update(sessions)
    .set({
      revokedAt: new Date(),
    })
    .where(eq(sessions.id, sessionRow.id))

  const [player] = await services.db
    .select({
      id: players.id,
      authType: players.authType,
      email: players.email,
      passwordHash: players.passwordHash,
    })
    .from(players)
    .where(eq(players.id, sessionRow.playerId))
    .limit(1)

  const isGuestWithoutCredentials =
    player?.authType === 'guest' && !player.email && !player.passwordHash
  if (isGuestWithoutCredentials) {
    await services.db.delete(players).where(eq(players.id, player.id))
  }
}
