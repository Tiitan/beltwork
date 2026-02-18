import { describe, expect, it } from 'vitest'
import { buildServer } from '../server.js'
import { clearTestDatabase } from '../test/testDatabase.js'

function getSessionCookiePair(setCookieHeader: string | string[] | undefined): string {
  const rawCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader
  if (!rawCookie) {
    throw new Error('missing set-cookie header')
  }

  const [cookiePair] = rawCookie.split(';')
  if (!cookiePair) {
    throw new Error('invalid set-cookie header')
  }

  return cookiePair
}

describe('auth routes', () => {
  it('returns unauthenticated when bootstrap has no session cookie', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/session/bootstrap',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ authenticated: false })
  })

  it('validates login payload', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'not-an-email',
        password: '',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toBe('invalid_payload')
  })

  it('returns invalid_google_token when verifier rejects token', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
      verifyGoogleIdToken: async () => {
        throw new Error('bad token')
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: {
        id_token: 'invalid-token',
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'invalid_google_token' })
  })

  it('returns google_email_not_verified when verifier enforces verified email', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
      verifyGoogleIdToken: async () => {
        throw new Error('google_email_not_verified')
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: {
        id_token: 'token-with-unverified-email',
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'google_email_not_verified' })
  })

  it('requires auth for google-link endpoint', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/settings/account/google-link',
      payload: {
        id_token: 'any-token',
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'unauthorized' })
  })

  it('requires auth for save settings endpoint', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/settings/account',
      payload: {
        display_name: 'Pilot',
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'unauthorized' })
  })

  it('always clears cookie on logout', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/session/logout',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
    expect(response.headers['set-cookie']).toContain('Max-Age=0')
  })

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'creates guest session on start-now and bootstraps profile from cookie',
    async () => {
      await clearTestDatabase()

      const app = buildServer({
        checkReadiness: async () => {},
      })

      const startNowResponse = await app.inject({
        method: 'POST',
        url: '/v1/session/start-now',
      })

      expect(startNowResponse.statusCode).toBe(200)
      expect(startNowResponse.json().authenticated).toBe(true)

      const cookiePair = getSessionCookiePair(startNowResponse.headers['set-cookie'])
      const bootstrapResponse = await app.inject({
        method: 'GET',
        url: '/v1/session/bootstrap',
        headers: {
          cookie: cookiePair,
        },
      })

      expect(bootstrapResponse.statusCode).toBe(200)
      expect(bootstrapResponse.json().authenticated).toBe(true)
      expect(bootstrapResponse.json().profile.auth_type).toBe('guest')
    },
  )
})
