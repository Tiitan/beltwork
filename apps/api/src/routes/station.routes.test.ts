import { describe, expect, it } from 'vitest'
import { pool } from '../db/client.js'
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

  it('requires authentication for station building creation', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/station/buildings',
      payload: {
        building_type: 'fusion_reactor',
        slot_index: 1,
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'unauthorized' })
  })

  it('requires authentication for station building upgrade', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/station/buildings/00000000-0000-0000-0000-000000000001',
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
      expect(stationResponse.json().id).toEqual(expect.any(String))
      expect(stationResponse.json().x).toEqual(expect.any(Number))
      expect(stationResponse.json().y).toEqual(expect.any(Number))
      expect(stationResponse.json().inventory).toEqual([
        { resource_key: 'carbon_materials', amount: 15 },
        { resource_key: 'conductors', amount: 25 },
        { resource_key: 'metals', amount: 50 },
        { resource_key: 'water', amount: 100 },
      ])
      expect(stationResponse.json().buildings).toEqual([])
      expect(stationResponse.json().buildable_buildings).toEqual([
        { id: 'fusion_reactor', name: 'Fusion Reactor' },
        { id: 'life_support', name: 'Life Support' },
        { id: 'radiators', name: 'Radiators' },
        { id: 'mining_docks', name: 'Mining Docks' },
        { id: 'scanner_survey', name: 'Scanner and Survey' },
        { id: 'refinery', name: 'Refinery' },
        { id: 'assembler', name: 'Assembler' },
        { id: 'storage', name: 'Storage' },
      ])
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'returns 400 for out-of-range slot index payload',
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

      const buildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: {
          cookie: cookiePair,
        },
        payload: {
          building_type: 'fusion_reactor',
          slot_index: 11,
        },
      })

      expect(buildResponse.statusCode).toBe(400)
      expect(buildResponse.json().error).toBe('invalid_payload')
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'returns 400 for unsupported building type',
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

      const buildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: {
          cookie: cookiePair,
        },
        payload: {
          building_type: 'unknown_building',
          slot_index: 1,
        },
      })

      expect(buildResponse.statusCode).toBe(400)
      expect(buildResponse.json()).toEqual({ error: 'unsupported_building_type' })
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'creates a temporary building and assigns it to selected slot',
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

      const buildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: {
          cookie: cookiePair,
        },
        payload: {
          building_type: 'fusion_reactor',
          slot_index: 1,
        },
      })

      expect(buildResponse.statusCode).toBe(200)
      const payload = buildResponse.json()
      expect(payload.id).toEqual(expect.any(String))
      expect(payload.x).toEqual(expect.any(Number))
      expect(payload.y).toEqual(expect.any(Number))
      expect(payload.buildings).toEqual([
        {
          id: expect.any(String),
          building_type: 'fusion_reactor',
          level: 1,
          status: 'idle',
          slot_index: 1,
        },
      ])
      expect(payload.buildable_buildings).toEqual([
        { id: 'life_support', name: 'Life Support' },
        { id: 'radiators', name: 'Radiators' },
        { id: 'mining_docks', name: 'Mining Docks' },
        { id: 'scanner_survey', name: 'Scanner and Survey' },
        { id: 'refinery', name: 'Refinery' },
        { id: 'assembler', name: 'Assembler' },
        { id: 'storage', name: 'Storage' },
      ])
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'returns 409 when placing a building into an occupied slot',
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

      const firstBuildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: {
          cookie: cookiePair,
        },
        payload: {
          building_type: 'fusion_reactor',
          slot_index: 1,
        },
      })
      expect(firstBuildResponse.statusCode).toBe(200)

      const secondBuildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: {
          cookie: cookiePair,
        },
        payload: {
          building_type: 'life_support',
          slot_index: 1,
        },
      })

      expect(secondBuildResponse.statusCode).toBe(409)
      expect(secondBuildResponse.json()).toEqual({ error: 'slot_occupied' })
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'returns 409 when building type already exists in station',
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

      const firstBuildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: {
          cookie: cookiePair,
        },
        payload: {
          building_type: 'fusion_reactor',
          slot_index: 1,
        },
      })
      expect(firstBuildResponse.statusCode).toBe(200)

      const secondBuildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: {
          cookie: cookiePair,
        },
        payload: {
          building_type: 'fusion_reactor',
          slot_index: 2,
        },
      })

      expect(secondBuildResponse.statusCode).toBe(409)
      expect(secondBuildResponse.json()).toEqual({ error: 'building_type_already_exists' })
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'keeps layout and building rows consistent under concurrent same-slot builds',
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
      const stationId = stationResponse.json().id as string

      const lockClient = await pool.connect()
      try {
        await lockClient.query('begin')
        await lockClient.query('select id from stations where id = $1 for update', [stationId])

        const buildOnePromise = app.inject({
          method: 'POST',
          url: '/v1/station/buildings',
          headers: {
            cookie: cookiePair,
          },
          payload: {
            building_type: 'fusion_reactor',
            slot_index: 1,
          },
        })

        const buildTwoPromise = app.inject({
          method: 'POST',
          url: '/v1/station/buildings',
          headers: {
            cookie: cookiePair,
          },
          payload: {
            building_type: 'life_support',
            slot_index: 1,
          },
        })

        await new Promise<void>((resolve) => {
          setTimeout(resolve, 50)
        })
        await lockClient.query('commit')

        const [buildOneResponse, buildTwoResponse] = await Promise.all([
          buildOnePromise,
          buildTwoPromise,
        ])
        const responses = [buildOneResponse, buildTwoResponse]
        const successResponses = responses.filter((response) => response.statusCode === 200)
        const conflictResponses = responses.filter((response) => response.statusCode === 409)

        expect(successResponses).toHaveLength(1)
        expect(conflictResponses).toHaveLength(1)
        expect(conflictResponses[0]?.json()).toEqual({ error: 'slot_occupied' })

        const finalSnapshotResponse = await app.inject({
          method: 'GET',
          url: '/v1/station',
          headers: {
            cookie: cookiePair,
          },
        })

        expect(finalSnapshotResponse.statusCode).toBe(200)
        const finalSnapshot = finalSnapshotResponse.json()
        expect(finalSnapshot.buildings).toHaveLength(1)
        expect(finalSnapshot.buildings[0]).toMatchObject({ slot_index: 1 })
      } finally {
        try {
          await lockClient.query('rollback')
        } catch {}
        lockClient.release()
      }
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'upgrades a building level instantly for the station owner',
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

      const buildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: {
          cookie: cookiePair,
        },
        payload: {
          building_type: 'storage',
          slot_index: 2,
        },
      })

      expect(buildResponse.statusCode).toBe(200)
      const buildingId = buildResponse.json().buildings[0].id as string

      const upgradeResponse = await app.inject({
        method: 'PATCH',
        url: `/v1/station/buildings/${buildingId}`,
        headers: {
          cookie: cookiePair,
        },
        payload: {
          action: 'upgrade',
        },
      })

      expect(upgradeResponse.statusCode).toBe(200)
      const payload = upgradeResponse.json()
      expect(payload.buildings).toEqual([
        {
          id: buildingId,
          building_type: 'storage',
          level: 2,
          status: 'idle',
          slot_index: 2,
        },
      ])
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'returns 404 for malformed building id on upgrade',
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

      const upgradeResponse = await app.inject({
        method: 'PATCH',
        url: '/v1/station/buildings/not-a-uuid',
        headers: {
          cookie: cookiePair,
        },
        payload: {
          action: 'upgrade',
        },
      })

      expect(upgradeResponse.statusCode).toBe(404)
      expect(upgradeResponse.json()).toEqual({ error: 'building_not_found' })
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'returns 400 for invalid upgrade action payload',
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

      const upgradeResponse = await app.inject({
        method: 'PATCH',
        url: '/v1/station/buildings/00000000-0000-0000-0000-000000000001',
        headers: {
          cookie: cookiePair,
        },
        payload: {
          action: 'not_upgrade',
        },
      })

      expect(upgradeResponse.statusCode).toBe(400)
      expect(upgradeResponse.json().error).toBe('invalid_payload')
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'returns 404 when upgrading an unknown building id',
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

      const upgradeResponse = await app.inject({
        method: 'PATCH',
        url: '/v1/station/buildings/00000000-0000-0000-0000-000000000001',
        headers: {
          cookie: cookiePair,
        },
        payload: {
          action: 'upgrade',
        },
      })

      expect(upgradeResponse.statusCode).toBe(404)
      expect(upgradeResponse.json()).toEqual({ error: 'building_not_found' })
    },
  )

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'returns 404 when upgrading a building owned by another player',
    async () => {
      await clearTestDatabase()

      const app = buildServer({
        checkReadiness: async () => {},
      })

      const playerOneStart = await app.inject({
        method: 'POST',
        url: '/v1/session/start-now',
      })
      const playerOneCookie = getSessionCookiePair(playerOneStart.headers['set-cookie'])

      const buildResponse = await app.inject({
        method: 'POST',
        url: '/v1/station/buildings',
        headers: {
          cookie: playerOneCookie,
        },
        payload: {
          building_type: 'storage',
          slot_index: 3,
        },
      })

      expect(buildResponse.statusCode).toBe(200)
      const playerOneBuildingId = buildResponse.json().buildings[0].id as string

      const playerTwoStart = await app.inject({
        method: 'POST',
        url: '/v1/session/start-now',
      })
      const playerTwoCookie = getSessionCookiePair(playerTwoStart.headers['set-cookie'])

      const upgradeResponse = await app.inject({
        method: 'PATCH',
        url: `/v1/station/buildings/${playerOneBuildingId}`,
        headers: {
          cookie: playerTwoCookie,
        },
        payload: {
          action: 'upgrade',
        },
      })

      expect(upgradeResponse.statusCode).toBe(404)
      expect(upgradeResponse.json()).toEqual({ error: 'building_not_found' })
    },
  )
})
