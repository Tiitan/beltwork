import { describe, expect, it } from 'vitest'
import { db } from '../db/client.js'
import { playerJournalEntries, players, stations } from '../db/schema.js'
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

describe('journal routes', () => {
  it('requires authentication for journal events', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/journal/events',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'unauthorized' })
  })

  it.runIf(process.env.RUN_DB_TESTS === '1')(
    'returns the latest 20 current-player journal events in newest-first order',
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

      const stationResponse = await app.inject({
        method: 'GET',
        url: '/v1/station',
        headers: { cookie: cookiePair },
      })
      const currentStationId = stationResponse.json().id as string

      const [otherPlayer] = await db
        .insert(players)
        .values({
          displayName: 'Other Player',
          authType: 'guest',
        })
        .returning({ id: players.id })

      const [otherStation] = await db
        .insert(stations)
        .values({
          playerId: otherPlayer.id,
          x: 999,
          y: 999,
        })
        .returning({ id: stations.id })

      const baseMs = Date.parse('2026-03-12T10:00:00.000Z')
      await db.insert(playerJournalEntries).values(
        Array.from({ length: 25 }, (_, index) => ({
          playerId: currentPlayerId,
          stationId: currentStationId,
          eventType: 'tests.journal.entry.v1',
          importance: index % 3 === 0 ? 'important' : index % 3 === 1 ? 'info' : 'warning',
          description: `Current player entry ${index}`,
          occurredAt: new Date(baseMs + index * 1_000),
          metadataJson: { order: index },
        })),
      )

      await db.insert(playerJournalEntries).values({
        playerId: otherPlayer.id,
        stationId: otherStation.id,
        eventType: 'tests.journal.entry.v1',
        importance: 'important',
        description: 'Other player entry',
        occurredAt: new Date(baseMs + 99_000),
        metadataJson: { order: 99 },
      })

      const journalResponse = await app.inject({
        method: 'GET',
        url: '/v1/journal/events',
        headers: { cookie: cookiePair },
      })

      expect(journalResponse.statusCode).toBe(200)
      const payload = journalResponse.json()
      expect(payload.events).toHaveLength(20)
      expect(payload.events[0]).toMatchObject({
        description: 'Current player entry 24',
        event_type: 'tests.journal.entry.v1',
      })
      expect(payload.events[19]).toMatchObject({
        description: 'Current player entry 5',
      })
      expect(payload.events.some((event: any) => event.description === 'Other player entry')).toBe(
        false,
      )
    },
  )
})
