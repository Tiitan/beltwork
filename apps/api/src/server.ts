import Fastify from 'fastify'
import cors from '@fastify/cors'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from 'node:crypto'
import { promisify } from 'node:util'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { z } from 'zod'
import { env } from './config.js'
import { db, checkDatabaseConnection } from './db/client.js'
import { playerIdentities, players, sessions } from './db/schema.js'
import {
  catchUpFactoryJob,
  catchUpInputSchema,
  clearRecipe,
  createSelectedJob,
  selectRecipeInputSchema,
  toFactoryJobReadModel,
  type FactoryJob,
} from './factory-jobs/service.js'

const scrypt = promisify(scryptCallback)
const SESSION_DURATION_DAYS = 30
const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
const GOOGLE_PROVIDER = 'google'
const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

type GoogleIdentityClaims = {
  sub: string
  email: string
  name: string
  emailVerified: boolean
}

type VerifyGoogleIdToken = (idToken: string) => Promise<GoogleIdentityClaims>

/**
 * Optional server dependency overrides for tests and local harnesses.
 */
type BuildServerOptions = {
  checkReadiness?: () => Promise<void>
  verifyGoogleIdToken?: VerifyGoogleIdToken
}

type AuthProfile = {
  id: string
  display_name: string
  auth_type: 'guest' | 'local' | 'google'
  email: string
  google_linked: boolean
  google_linked_email: string
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {}
  }

  const cookies: Record<string, string> = {}
  for (const cookiePart of cookieHeader.split(';')) {
    const [rawKey, ...rawValueParts] = cookiePart.trim().split('=')
    if (!rawKey || rawValueParts.length === 0) {
      continue
    }

    cookies[decodeURIComponent(rawKey)] = decodeURIComponent(rawValueParts.join('='))
  }

  return cookies
}

function signSessionToken(token: string): string {
  return createHmac('sha256', env.SESSION_COOKIE_SECRET).update(token).digest('base64url')
}

function encodeSignedSessionCookieValue(token: string): string {
  return `${token}.${signSessionToken(token)}`
}

function decodeAndVerifySignedSessionCookieValue(rawValue: string | undefined): string | null {
  if (!rawValue) {
    return null
  }

  const delimiterIndex = rawValue.lastIndexOf('.')
  if (delimiterIndex <= 0 || delimiterIndex >= rawValue.length - 1) {
    return null
  }

  const token = rawValue.slice(0, delimiterIndex)
  const signature = rawValue.slice(delimiterIndex + 1)
  const expectedSignature = signSessionToken(token)

  const expectedBuffer = Buffer.from(expectedSignature)
  const receivedBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== receivedBuffer.length) {
    return null
  }

  if (!timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return null
  }

  return token
}

function isSecureCookie(): boolean {
  return env.NODE_ENV === 'production'
}

function serializeSessionCookie(token: string): string {
  const cookieValue = encodeSignedSessionCookieValue(token)
  const attributes = [
    `${encodeURIComponent(env.SESSION_COOKIE_NAME)}=${encodeURIComponent(cookieValue)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_DURATION_DAYS * 24 * 60 * 60}`,
  ]

  if (isSecureCookie()) {
    attributes.push('Secure')
  }

  return attributes.join('; ')
}

function serializeExpiredSessionCookie(): string {
  const attributes = [
    `${encodeURIComponent(env.SESSION_COOKIE_NAME)}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
  ]

  if (isSecureCookie()) {
    attributes.push('Secure')
  }

  return attributes.join('; ')
}

function buildGuestDisplayName(): string {
  const suffix = Math.floor(Math.random() * 9000) + 1000
  return `Calm Prospector ${suffix}`
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function parseEmailVerifiedClaim(payload: JWTPayload): boolean {
  if (payload.email_verified === true) {
    return true
  }

  if (payload.email_verified === 'true') {
    return true
  }

  return false
}

async function defaultVerifyGoogleIdToken(idToken: string): Promise<GoogleIdentityClaims> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error('google_client_id_not_configured')
  }

  const allowedIssuers = env.GOOGLE_ALLOWED_ISSUERS.split(',')
    .map((issuer) => issuer.trim())
    .filter((issuer) => issuer.length > 0)

  const { payload } = await jwtVerify(idToken, googleJwks, {
    audience: env.GOOGLE_CLIENT_ID,
    issuer: allowedIssuers,
  })

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('invalid_google_sub')
  }

  if (typeof payload.email !== 'string' || payload.email.length === 0) {
    throw new Error('invalid_google_email')
  }

  const emailVerified = parseEmailVerifiedClaim(payload)
  if (!emailVerified) {
    throw new Error('google_email_not_verified')
  }

  return {
    sub: payload.sub,
    email: normalizeEmail(payload.email),
    name:
      typeof payload.name === 'string' && payload.name.trim().length > 0
        ? payload.name
        : 'Google Pilot',
    emailVerified,
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hashBuffer = (await scrypt(password, salt, 64)) as Buffer
  return `scrypt$${salt}$${hashBuffer.toString('hex')}`
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const hashParts = storedHash.split('$')
  if (hashParts.length !== 3 || hashParts[0] !== 'scrypt') {
    return false
  }

  const [, salt, expectedHashHex] = hashParts
  const actualHashBuffer = (await scrypt(password, salt, 64)) as Buffer
  const expectedHashBuffer = Buffer.from(expectedHashHex, 'hex')

  if (actualHashBuffer.length !== expectedHashBuffer.length) {
    return false
  }

  return timingSafeEqual(actualHashBuffer, expectedHashBuffer)
}

async function createSessionForPlayer(playerId: string): Promise<string> {
  const sessionToken = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await db.insert(sessions).values({
    playerId,
    sessionToken,
    expiresAt,
  })

  return sessionToken
}

async function resolveAuth(request: any): Promise<{
  sessionId: string
  playerId: string
} | null> {
  const cookies = parseCookies(request.headers.cookie)
  const signedCookieValue = cookies[env.SESSION_COOKIE_NAME]
  const sessionToken = decodeAndVerifySignedSessionCookieValue(signedCookieValue)

  if (!sessionToken) {
    return null
  }

  const [sessionRow] = await db
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

  if (!sessionRow) {
    return null
  }

  await db
    .update(sessions)
    .set({
      lastSeenAt: new Date(),
    })
    .where(eq(sessions.id, sessionRow.sessionId))

  return sessionRow
}

async function loadAuthProfile(playerId: string): Promise<AuthProfile | null> {
  const [player] = await db
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

  const [googleIdentity] = await db
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

/**
 * Creates and configures the Fastify API instance.
 *
 * @param options Optional dependency overrides, mainly used by tests.
 * @returns Configured Fastify server instance.
 */
export function buildServer(options: BuildServerOptions = {}) {
  /**
   * Readiness checker dependency used by the readiness endpoint.
   */
  const checkReadiness = options.checkReadiness ?? checkDatabaseConnection
  const verifyGoogleIdToken = options.verifyGoogleIdToken ?? defaultVerifyGoogleIdToken
  /**
   * In-memory factory job state keyed by factory id.
   */
  const factoryJobs = new Map<string, FactoryJob>()

  const app = Fastify({
    logger: true,
  })

  app.register(cors, {
    origin: true,
    credentials: true,
  })

  /**
   * Handles readiness checks by validating downstream dependencies.
   *
   * @returns Readiness status payload.
   */
  async function handleReady(_: unknown, reply: any) {
    try {
      await checkReadiness()
      return { status: 'ready' }
    } catch (error) {
      app.log.error({ error }, 'readiness check failed')
      return reply.code(503).send({ status: 'not_ready' })
    }
  }

  /**
   * Handles liveness checks for process health.
   *
   * @returns Liveness status payload.
   */
  async function handleLive() {
    return { status: 'ok' }
  }

  /**
   * Bootstraps session state from signed cookie.
   */
  async function handleSessionBootstrap(request: any) {
    const auth = await resolveAuth(request)
    if (!auth) {
      return {
        authenticated: false,
      }
    }

    const profile = await loadAuthProfile(auth.playerId)
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

  /**
   * Starts an anonymous guest session and sets signed session cookie.
   */
  async function handleStartNow(_: unknown, reply: any) {
    const [player] = await db
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

    const sessionToken = await createSessionForPlayer(player.id)
    reply.header('Set-Cookie', serializeSessionCookie(sessionToken))

    const profile = await loadAuthProfile(player.id)
    if (!profile) {
      return reply.code(404).send({ error: 'player_not_found' })
    }

    return { authenticated: true, profile }
  }

  /**
   * Signs in with local credentials and issues a fresh session cookie.
   */
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
    const [player] = await db
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

    if (!player?.password_hash) {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }

    const isValidPassword = await verifyPassword(body.data.password, player.password_hash)
    if (!isValidPassword) {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }

    const sessionToken = await createSessionForPlayer(player.id)
    reply.header('Set-Cookie', serializeSessionCookie(sessionToken))

    const profile = await loadAuthProfile(player.id)
    if (!profile) {
      return reply.code(404).send({ error: 'player_not_found' })
    }

    return { authenticated: true, profile }
  }

  /**
   * Signs in with Google ID token and issues a fresh session cookie.
   */
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

    let claims: GoogleIdentityClaims
    try {
      claims = await verifyGoogleIdToken(body.data.id_token)
    } catch (error: any) {
      if (error?.message === 'google_email_not_verified') {
        return reply.code(401).send({ error: 'google_email_not_verified' })
      }
      return reply.code(401).send({ error: 'invalid_google_token' })
    }

    const [existingIdentity] = await db
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

    if (!playerId) {
      const [emailPlayer] = await db
        .select({
          id: players.id,
        })
        .from(players)
        .where(eq(players.email, claims.email))
        .limit(1)

      if (emailPlayer) {
        playerId = emailPlayer.id
      } else {
        const [createdPlayer] = await db
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
      }

      try {
        await db.insert(playerIdentities).values({
          playerId,
          provider: GOOGLE_PROVIDER,
          providerUserId: claims.sub,
          email: claims.email,
        })
      } catch (error: any) {
        if (error?.code === '23505') {
          const [linkedIdentity] = await db
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
        } else {
          throw error
        }
      }
    }

    const sessionToken = await createSessionForPlayer(playerId)
    reply.header('Set-Cookie', serializeSessionCookie(sessionToken))

    const profile = await loadAuthProfile(playerId)
    if (!profile) {
      return reply.code(404).send({ error: 'player_not_found' })
    }

    return {
      authenticated: true,
      profile,
    }
  }

  /**
   * Links a Google identity to the currently authenticated account.
   */
  async function handleGoogleLink(request: any, reply: any) {
    const auth = await resolveAuth(request)
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

    let claims: GoogleIdentityClaims
    try {
      claims = await verifyGoogleIdToken(body.data.id_token)
    } catch (error: any) {
      if (error?.message === 'google_email_not_verified') {
        return reply.code(401).send({ error: 'google_email_not_verified' })
      }
      return reply.code(401).send({ error: 'invalid_google_token' })
    }

    const [existingIdentity] = await db
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

    if (existingIdentity && existingIdentity.playerId !== auth.playerId) {
      return reply.code(409).send({ error: 'google_identity_in_use' })
    }

    if (!existingIdentity) {
      try {
        await db.insert(playerIdentities).values({
          playerId: auth.playerId,
          provider: GOOGLE_PROVIDER,
          providerUserId: claims.sub,
          email: claims.email,
        })
      } catch (error: any) {
        if (error?.code === '23505') {
          return reply.code(409).send({ error: 'google_identity_in_use' })
        }
        throw error
      }
    }

    const [currentPlayer] = await db
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
        await db
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

    const profile = await loadAuthProfile(auth.playerId)
    if (!profile) {
      return reply.code(404).send({ error: 'player_not_found' })
    }

    return {
      authenticated: true,
      profile,
    }
  }

  /**
   * Persists account settings for the current player and upgrades to local auth when credentials are provided.
   */
  async function handleSaveSettings(request: any, reply: any) {
    const auth = await resolveAuth(request)
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
      await db.update(players).set(nextValues).where(eq(players.id, auth.playerId))
    } catch (error: any) {
      if (error?.code === '23505') {
        return reply.code(409).send({ error: 'email_already_used' })
      }
      throw error
    }

    const profile = await loadAuthProfile(auth.playerId)
    if (!profile) {
      return reply.code(404).send({ error: 'player_not_found' })
    }

    return {
      authenticated: true,
      profile,
    }
  }

  /**
   * Revokes current session and clears cookie. Guest profiles without credentials are deleted permanently.
   */
  async function handleLogout(request: any, reply: any) {
    const cookies = parseCookies(request.headers.cookie)
    const signedCookieValue = cookies[env.SESSION_COOKIE_NAME]
    const sessionToken = decodeAndVerifySignedSessionCookieValue(signedCookieValue)

    if (sessionToken) {
      const [sessionRow] = await db
        .select({
          id: sessions.id,
          playerId: sessions.playerId,
        })
        .from(sessions)
        .where(eq(sessions.sessionToken, sessionToken))
        .limit(1)

      if (sessionRow) {
        await db
          .update(sessions)
          .set({
            revokedAt: new Date(),
          })
          .where(eq(sessions.id, sessionRow.id))

        const [player] = await db
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
          await db.delete(players).where(eq(players.id, player.id))
        }
      }
    }

    reply.header('Set-Cookie', serializeExpiredSessionCookie())
    return { ok: true }
  }

  /**
   * Selects a recipe for a factory and starts a corresponding production job.
   *
   * @returns Job read model and emitted domain events.
   */
  async function handleSelectRecipe(request: any, reply: any) {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const body = selectRecipeInputSchema.safeParse(request.body)

    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: [
          ...(params.success ? [] : params.error.issues),
          ...(body.success ? [] : body.error.issues),
        ],
      })
    }

    const now = new Date()
    const job = createSelectedJob(params.data.id, body.data, now)
    factoryJobs.set(params.data.id, job)

    return {
      job: toFactoryJobReadModel(job),
      events: [
        {
          event_type: 'factory.recipe.selected',
          payload: {
            factory_id: job.factoryId,
            recipe_key: job.recipeKey,
            target_cycles: job.targetCycles,
          },
        },
      ],
    }
  }

  /**
   * Advances an existing factory job based on elapsed time and capacities.
   *
   * @returns Updated job read model and resulting events.
   */
  async function handleCatchUp(request: any, reply: any) {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const body = catchUpInputSchema.safeParse(request.body)

    if (!params.success || !body.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: [
          ...(params.success ? [] : params.error.issues),
          ...(body.success ? [] : body.error.issues),
        ],
      })
    }

    const existing = factoryJobs.get(params.data.id)
    if (!existing) {
      return reply.code(404).send({ error: 'factory_job_not_found' })
    }

    const next = catchUpFactoryJob(existing, body.data)
    factoryJobs.set(params.data.id, next)

    const events: Array<{ event_type: string; payload: Record<string, unknown> }> = []
    const producedCycles = next.cyclesCompleted - existing.cyclesCompleted

    if (producedCycles > 0) {
      events.push({
        event_type: 'inventory.changed',
        payload: {
          factory_id: next.factoryId,
          produced_cycles: producedCycles,
        },
      })
    }

    if (next.completedAt !== null && existing.completedAt === null && next.targetCycles !== null) {
      events.push({
        event_type: 'factory.production.completed',
        payload: {
          factory_id: next.factoryId,
          completed_cycles: next.cyclesCompleted,
          target_cycles: next.targetCycles,
        },
      })
    }

    return { job: toFactoryJobReadModel(next), events }
  }

  /**
   * Clears the selected recipe from an existing factory job.
   *
   * @returns Updated job read model.
   */
  async function handleClearRecipe(request: any, reply: any) {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_payload', details: params.error.issues })
    }

    const existing = factoryJobs.get(params.data.id)
    if (!existing) {
      return reply.code(404).send({ error: 'factory_job_not_found' })
    }

    const next = clearRecipe(existing, new Date())
    factoryJobs.set(params.data.id, next)

    return { job: toFactoryJobReadModel(next) }
  }

  /**
   * Fetches the current state for a specific factory job.
   *
   * @returns Factory job read model.
   */
  async function handleGetFactory(request: any, reply: any) {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_payload', details: params.error.issues })
    }

    const existing = factoryJobs.get(params.data.id)
    if (!existing) {
      return reply.code(404).send({ error: 'factory_job_not_found' })
    }

    return { job: toFactoryJobReadModel(existing) }
  }

  app.get('/ready', handleReady)
  app.get('/live', handleLive)
  app.get('/v1/session/bootstrap', handleSessionBootstrap)
  app.post('/v1/session/start-now', handleStartNow)
  app.post('/v1/auth/login', handleLogin)
  app.post('/auth/login', handleLogin)
  app.post('/v1/auth/google', handleGoogleSignIn)
  app.post('/v1/settings/account/google-link', handleGoogleLink)
  app.post('/v1/settings/account', handleSaveSettings)
  app.post('/v1/session/logout', handleLogout)
  app.post('/v1/factories/:id/select-recipe', handleSelectRecipe)
  app.post('/v1/factories/:id/catch-up', handleCatchUp)
  app.post('/v1/factories/:id/clear-recipe', handleClearRecipe)
  app.get('/v1/factories/:id', handleGetFactory)

  return app
}
