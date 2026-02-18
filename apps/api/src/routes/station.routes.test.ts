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

describe('station routes', () => {
  it('requires authentication for station snapshot', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/station',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'unauthorized' })
  })

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'returns seeded startup inventory for a new guest station',
    async () => {
      await clearTestDatabase()

      const app = buildServer({
        checkReadiness: async () => {},
      })

      const startNowResponse = await app.inject({
        method: 'POST',
        url: '/v1/session/start-now',
      })
      const cookiePair = getSessionCookiePair(startNowResponse.headers['set-cookie'])

      const stationResponse = await app.inject({
        method: 'GET',
        url: '/v1/station',
        headers: {
          cookie: cookiePair,
        },
      })

      expect(stationResponse.statusCode).toBe(200)
      expect(stationResponse.json().inventory).toEqual([
        { resource_key: 'carbon_materials', amount: 15 },
        { resource_key: 'conductors', amount: 25 },
        { resource_key: 'metals', amount: 50 },
        { resource_key: 'water', amount: 100 },
      ])
    },
  )
})
