import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  decodeJournalCursor,
  getJournalEventsForPlayer,
  JOURNAL_DATE_RANGE_VALUES,
  JOURNAL_EVENT_TYPE_VALUES,
  JOURNAL_IMPORTANCE_VALUES,
} from '../services/journal.service.js'
import { resolveAuth } from '../services/auth.service.js'
import type { AppServices } from '../types/api.js'

const journalQuerySchema = z.object({
  date_range: z.enum(JOURNAL_DATE_RANGE_VALUES).optional(),
  importance: z.array(z.enum(JOURNAL_IMPORTANCE_VALUES)).optional(),
  event_type: z.array(z.enum(JOURNAL_EVENT_TYPE_VALUES)).optional(),
  cursor: z.string().optional(),
})

export function registerJournalRoutes(app: FastifyInstance, services: AppServices): void {
  async function handleJournalEvents(request: any, reply: any) {
    const auth = await resolveAuth(services, request)
    if (!auth) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    let query
    try {
      const rawQuery = (request.query ?? {}) as Record<string, unknown>
      query = journalQuerySchema.parse({
        date_range: readOptionalStringParam(rawQuery.date_range, 'date_range'),
        importance: parseCsvQueryParam(rawQuery.importance, 'importance'),
        event_type: parseCsvQueryParam(rawQuery.event_type, 'event_type'),
        cursor: readOptionalStringParam(rawQuery.cursor, 'cursor'),
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'invalid_payload', details: error.issues })
      }

      throw error
    }

    let cursor = null
    if (query.cursor) {
      try {
        cursor = decodeJournalCursor(query.cursor)
      } catch {
        return reply.code(400).send({
          error: 'invalid_payload',
          details: [{ code: 'custom', path: ['cursor'], message: 'Invalid journal cursor' }],
        })
      }
    }

    return getJournalEventsForPlayer(services, auth.playerId, {
      dateRange: query.date_range,
      importance: query.importance,
      eventTypes: query.event_type,
      cursor,
    })
  }

  app.get('/v1/journal/events', handleJournalEvents)
}

function readOptionalStringParam(value: unknown, key: string): string | undefined {
  if (typeof value === 'undefined') {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new z.ZodError([{ code: 'custom', path: [key], message: 'Expected query string value' }])
  }

  return value
}

function parseCsvQueryParam(value: unknown, key: string): string[] | undefined {
  const rawValue = readOptionalStringParam(value, key)
  if (typeof rawValue === 'undefined') {
    return undefined
  }

  const tokens = rawValue.split(',').map((token) => token.trim())
  if (tokens.length === 0 || tokens.some((token) => token.length === 0)) {
    throw new z.ZodError([
      { code: 'custom', path: [key], message: 'Invalid comma-separated values' },
    ])
  }

  return [...new Set(tokens)]
}
