import type {
  JournalEventsPage,
  JournalEventType,
  JournalFilters,
  JournalImportance,
} from '../../types/app'

type JournalEventsResponse = {
  events: Array<{
    id: string
    event_type: string
    importance: 'info' | 'important' | 'warning'
    description: string
    occurred_at: string
  }>
  next_cursor: string | null
}

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (typeof init.body !== 'undefined' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  return fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })
}

function serializeJournalCsvValues(
  values: JournalImportance[] | JournalEventType[],
): string | null {
  return values.length > 0 ? values.join(',') : null
}

export async function fetchJournalEvents(
  filters: JournalFilters,
  cursor?: string | null,
): Promise<JournalEventsPage> {
  const params = new URLSearchParams()
  if (filters.dateRange !== 'all') {
    params.set('date_range', filters.dateRange)
  }

  const importance = serializeJournalCsvValues(filters.importance)
  if (importance) {
    params.set('importance', importance)
  }

  const eventTypes = serializeJournalCsvValues(filters.eventTypes)
  if (eventTypes) {
    params.set('event_type', eventTypes)
  }

  if (cursor) {
    params.set('cursor', cursor)
  }

  const path = params.size > 0 ? `/v1/journal/events?${params.toString()}` : '/v1/journal/events'
  const response = await apiFetch(path, { method: 'GET' })
  if (!response.ok) {
    throw new Error('failed_to_fetch_journal_events')
  }

  const payload = (await response.json()) as JournalEventsResponse
  return {
    events: payload.events.map((event) => ({
      id: event.id,
      eventType: event.event_type,
      importance: event.importance,
      description: event.description,
      occurredAt: event.occurred_at,
    })),
    nextCursor: payload.next_cursor,
  }
}
