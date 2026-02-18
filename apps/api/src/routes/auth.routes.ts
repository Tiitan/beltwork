import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { players } from '../db/schema.js'
import {
  createGuestPlayer,
  findPlayerByEmail,
  linkGoogleIdentityToPlayer,
  loadAuthProfile,
  normalizeEmail,
  resolveAuth,
  resolvePlayerForGoogleSignIn,
} from '../services/auth.service.js'
import {
  createSessionForPlayer,
  revokeSessionAndDeleteEphemeralGuestIfNeeded,
} from '../services/session.service.js'
import { createStationForPlayer } from '../services/station.service.js'
import type { AppServices, AuthProfile } from '../types/api.js'
import {
  parseCookies,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  decodeAndVerifySignedSessionCookieValue,
} from '../utils/cookies.js'
import { hashPassword, verifyPassword } from '../utils/passwords.js'

async function sendProfileOrNotFound(
  app: FastifyInstance,
  services: AppServices,
  reply: any,
  playerId: string,
): Promise<{ authenticated: true; profile: AuthProfile } | any> {
  const profile = await loadAuthProfile(services, playerId)
  if (!profile) {
    return reply.code(404).send({ error: 'player_not_found' })
  }

  return {
    authenticated: true,
    profile,
  }
}

export function registerAuthRoutes(app: FastifyInstance, services: AppServices): void {
  async function handleSessionBootstrap(request: any) {
    const auth = await resolveAuth(services, request)
    if (!auth) {
      return {
        authenticated: false,
      }
    }

    const profile = await loadAuthProfile(services, auth.playerId)
    if (!profile) {
      return {
        authenticated: false,
      }
    }

    return {
      authenticated: true,
      profile,
    }
  }

  async function handleStartNow(_: unknown, reply: any) {
    const player = await createGuestPlayer(services)
    await createStationForPlayer(services, player.id)

    const sessionToken = await createSessionForPlayer(services, player.id)
    reply.header('Set-Cookie', serializeSessionCookie(sessionToken, services.env))

    return sendProfileOrNotFound(app, services, reply, player.id)
  }

  async function handleLogin(request: any, reply: any) {
    const body = z
      .object({
        email: z.string().trim().email(),
        password: z.string().min(1),
      })
      .safeParse(request.body)

    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: body.error.issues,
      })
    }

    const email = normalizeEmail(body.data.email)
    const player = await findPlayerByEmail(services, email)
    if (!player?.password_hash) {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }

    const isValidPassword = await verifyPassword(body.data.password, player.password_hash)
    if (!isValidPassword) {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }

    const sessionToken = await createSessionForPlayer(services, player.id)
    reply.header('Set-Cookie', serializeSessionCookie(sessionToken, services.env))

    return sendProfileOrNotFound(app, services, reply, player.id)
  }

  async function handleGoogleSignIn(request: any, reply: any) {
    const body = z
      .object({
        id_token: z.string().min(1),
      })
      .safeParse(request.body)

    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: body.error.issues,
      })
    }

    let claims
    try {
      claims = await services.verifyGoogleIdToken(body.data.id_token)
    } catch (error: any) {
      if (error?.message === 'google_email_not_verified') {
        return reply.code(401).send({ error: 'google_email_not_verified' })
      }
      return reply.code(401).send({ error: 'invalid_google_token' })
    }

    const { playerId, isNewPlayer } = await resolvePlayerForGoogleSignIn(services, claims)
    if (isNewPlayer) {
      await createStationForPlayer(services, playerId)
    }

    const sessionToken = await createSessionForPlayer(services, playerId)
    reply.header('Set-Cookie', serializeSessionCookie(sessionToken, services.env))

    return sendProfileOrNotFound(app, services, reply, playerId)
  }

  async function handleGoogleLink(request: any, reply: any) {
    const auth = await resolveAuth(services, request)
    if (!auth) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const body = z
      .object({
        id_token: z.string().min(1),
      })
      .safeParse(request.body)

    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: body.error.issues,
      })
    }

    let claims
    try {
      claims = await services.verifyGoogleIdToken(body.data.id_token)
    } catch (error: any) {
      if (error?.message === 'google_email_not_verified') {
        return reply.code(401).send({ error: 'google_email_not_verified' })
      }
      return reply.code(401).send({ error: 'invalid_google_token' })
    }

    const linkResult = await linkGoogleIdentityToPlayer(services, auth.playerId, claims)
    if (linkResult === 'in_use') {
      return reply.code(409).send({ error: 'google_identity_in_use' })
    }

    const [currentPlayer] = await services.db
      .select({
        authType: players.authType,
        email: players.email,
      })
      .from(players)
      .where(eq(players.id, auth.playerId))
      .limit(1)

    if (!currentPlayer) {
      return reply.code(404).send({ error: 'player_not_found' })
    }

    if (currentPlayer.authType === 'guest') {
      const nextEmail = currentPlayer.email ?? claims.email
      try {
        await services.db
          .update(players)
          .set({
            authType: 'google',
            email: nextEmail,
            updatedAt: new Date(),
          })
          .where(eq(players.id, auth.playerId))
      } catch (error: any) {
        if (error?.code === '23505') {
          return reply.code(409).send({ error: 'email_already_used' })
        }
        throw error
      }
    }

    return sendProfileOrNotFound(app, services, reply, auth.playerId)
  }

  async function handleSaveSettings(request: any, reply: any) {
    const auth = await resolveAuth(services, request)
    if (!auth) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const body = z
      .object({
        display_name: z.string().trim().min(1).max(100).optional(),
        email: z.string().trim().email().optional(),
        password: z.string().min(1).optional(),
      })
      .safeParse(request.body)

    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: body.error.issues,
      })
    }

    const { display_name, email, password } = body.data
    if ((email && !password) || (!email && password)) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: [{ message: 'email and password must be provided together' }],
      })
    }

    const nextValues: {
      displayName?: string
      updatedAt: Date
      email?: string
      passwordHash?: string
      authType?: 'guest' | 'local' | 'google'
    } = {
      updatedAt: new Date(),
    }

    if (display_name) {
      nextValues.displayName = display_name
    }

    if (email && password) {
      nextValues.email = normalizeEmail(email)
      nextValues.passwordHash = await hashPassword(password)
      nextValues.authType = 'local'
    }

    try {
      await services.db.update(players).set(nextValues).where(eq(players.id, auth.playerId))
    } catch (error: any) {
      if (error?.code === '23505') {
        return reply.code(409).send({ error: 'email_already_used' })
      }
      throw error
    }

    return sendProfileOrNotFound(app, services, reply, auth.playerId)
  }

  async function handleLogout(request: any, reply: any) {
    const cookies = parseCookies(request.headers.cookie)
    const signedCookieValue = cookies[services.env.SESSION_COOKIE_NAME]
    const sessionToken = decodeAndVerifySignedSessionCookieValue(
      signedCookieValue,
      services.env.SESSION_COOKIE_SECRET,
    )

    if (sessionToken) {
      await revokeSessionAndDeleteEphemeralGuestIfNeeded(services, sessionToken)
    }

    reply.header('Set-Cookie', serializeExpiredSessionCookie(services.env))
    return { ok: true }
  }

  app.get('/v1/session/bootstrap', handleSessionBootstrap)
  app.post('/v1/session/start-now', handleStartNow)
  app.post('/v1/auth/login', handleLogin)
  app.post('/auth/login', handleLogin)
  app.post('/v1/auth/google', handleGoogleSignIn)
  app.post('/v1/settings/account/google-link', handleGoogleLink)
  app.post('/v1/settings/account', handleSaveSettings)
  app.post('/v1/session/logout', handleLogout)
}
