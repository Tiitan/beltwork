import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '../db/client.js'
import { asteroid, players, scannedAsteroids, stations } from '../db/schema.js'
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

describe('map routes', () => {
  it('requires authentication for map snapshot', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/map',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'unauthorized' })
  })

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'returns all stations and non-depleted asteroids with scan-safe visibility',
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

      const bootstrapResponse = await app.inject({
        method: 'GET',
        url: '/v1/session/bootstrap',
        headers: { cookie: cookiePair },
      })
      const currentPlayerId = bootstrapResponse.json().profile.id as string

      const [otherPlayer] = await db
        .insert(players)
        .values({
          displayName: 'Other Player',
          authType: 'guest',
        })
        .returning({ id: players.id })

      await db.insert(stations).values({
        playerId: otherPlayer.id,
        x: 900,
        y: 901,
      })

      const [scannedAsteroid] = await db
        .insert(asteroid)
        .values({
          templateId: 'metal_rich',
          x: 100,
          y: 200,
          remainingUnits: 1234,
          seed: 'seed-a',
          isDepleted: false,
        })
        .returning({ id: asteroid.id })

      const [unscannedAsteroid] = await db
        .insert(asteroid)
        .values({
          templateId: 'common_chondrite',
          x: 300,
          y: 400,
          remainingUnits: 2222,
          seed: 'seed-b',
          isDepleted: false,
        })
        .returning({ id: asteroid.id })

      await db.insert(asteroid).values({
        templateId: 'icy_rare',
        x: 500,
        y: 600,
        remainingUnits: 0,
        seed: 'seed-c',
        isDepleted: true,
      })

      await db.insert(scannedAsteroids).values({
        playerId: currentPlayerId,
        asteroidId: scannedAsteroid.id,
        remainingUnits: 999,
      })

      const mapResponse = await app.inject({
        method: 'GET',
        url: '/v1/map',
        headers: { cookie: cookiePair },
      })

      expect(mapResponse.statusCode).toBe(200)
      const payload = mapResponse.json()

      expect(payload.stations.length).toBe(2)
      for (const station of payload.stations) {
        expect(typeof station.name).toBe('string')
        expect(station.name.length).toBeGreaterThan(0)
      }

      expect(payload.asteroids).toHaveLength(2)
      const scanned = payload.asteroids.find((row: any) => row.id === scannedAsteroid.id)
      const unscanned = payload.asteroids.find((row: any) => row.id === unscannedAsteroid.id)

      expect(scanned).toMatchObject({
        id: scannedAsteroid.id,
        is_scanned: true,
        name: 'Metal-Rich Fragment',
        yield_multiplier: 1.15,
        composition: {
          metals: 0.7,
          conductors: 0.15,
          carbon_materials: 0.1,
          water: 0.05,
        },
        template_id: 'metal_rich',
        scanned_remaining_units: 999,
      })
      expect(typeof scanned.scanned_at).toBe('string')

      expect(unscanned).toEqual({
        id: unscannedAsteroid.id,
        x: 300,
        y: 400,
        is_scanned: false,
      })
      expect(Object.hasOwn(unscanned, 'template_id')).toBe(false)
      expect(Object.hasOwn(unscanned, 'name')).toBe(false)
      expect(Object.hasOwn(unscanned, 'yield_multiplier')).toBe(false)
      expect(Object.hasOwn(unscanned, 'composition')).toBe(false)
      expect(Object.hasOwn(unscanned, 'scanned_remaining_units')).toBe(false)
      expect(Object.hasOwn(unscanned, 'scanned_at')).toBe(false)

      const [liveScannedAsteroid] = await db
        .select({
          remainingUnits: asteroid.remainingUnits,
        })
        .from(asteroid)
        .where(eq(asteroid.id, scannedAsteroid.id))
        .limit(1)
      expect(liveScannedAsteroid?.remainingUnits).toBe(1234)
      expect(scanned.scanned_remaining_units).toBe(999)
    },
  )

  it('requires authentication for asteroid scan', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/asteroids/00000000-0000-0000-0000-000000000000/scan',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'unauthorized' })
  })

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'scans asteroid immediately and updates existing player scan snapshot',
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

      const bootstrapResponse = await app.inject({
        method: 'GET',
        url: '/v1/session/bootstrap',
        headers: { cookie: cookiePair },
      })
      const currentPlayerId = bootstrapResponse.json().profile.id as string

      const [targetAsteroid] = await db
        .insert(asteroid)
        .values({
          templateId: 'metal_rich',
          x: 12,
          y: 34,
          remainingUnits: 333,
          seed: 'scan-seed',
          isDepleted: false,
        })
        .returning({ id: asteroid.id })

      const firstScanResponse = await app.inject({
        method: 'POST',
        url: `/v1/asteroids/${targetAsteroid.id}/scan`,
        headers: { cookie: cookiePair },
      })

      expect(firstScanResponse.statusCode).toBe(200)
      expect(firstScanResponse.json()).toMatchObject({
        scanned: true,
        asteroid_id: targetAsteroid.id,
        remaining_units: 333,
      })

      const firstScanRows = await db
        .select({
          remainingUnits: scannedAsteroids.remainingUnits,
        })
        .from(scannedAsteroids)
        .where(
          and(
            eq(scannedAsteroids.playerId, currentPlayerId),
            eq(scannedAsteroids.asteroidId, targetAsteroid.id),
          ),
        )

      expect(firstScanRows).toHaveLength(1)
      expect(firstScanRows[0]?.remainingUnits).toBe(333)

      await db
        .update(asteroid)
        .set({ remainingUnits: 111 })
        .where(eq(asteroid.id, targetAsteroid.id))

      const secondScanResponse = await app.inject({
        method: 'POST',
        url: `/v1/asteroids/${targetAsteroid.id}/scan`,
        headers: { cookie: cookiePair },
      })

      expect(secondScanResponse.statusCode).toBe(200)
      expect(secondScanResponse.json()).toMatchObject({
        scanned: true,
        asteroid_id: targetAsteroid.id,
        remaining_units: 111,
      })

      const secondScanRows = await db
        .select({
          remainingUnits: scannedAsteroids.remainingUnits,
        })
        .from(scannedAsteroids)
        .where(
          and(
            eq(scannedAsteroids.playerId, currentPlayerId),
            eq(scannedAsteroids.asteroidId, targetAsteroid.id),
          ),
        )

      expect(secondScanRows).toHaveLength(1)
      expect(secondScanRows[0]?.remainingUnits).toBe(111)
    },
  )
})
