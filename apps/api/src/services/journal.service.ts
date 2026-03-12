import { and, desc, eq, gte, inArray, lt, or } from 'drizzle-orm'
import { playerJournalEntries, stations } from '../db/schema.js'
import type { AppServices, JournalEventsResponse } from '../types/api.js'
import { loadBuildingNamesById, loadResourceNamesById } from './catalog-config.service.js'

export const PLAYER_JOURNAL_PAGE_SIZE = 20
export const JOURNAL_DATE_RANGE_VALUES = ['all', '24h', '7d', '30d'] as const
export const JOURNAL_IMPORTANCE_VALUES = ['info', 'important', 'warning'] as const
export const JOURNAL_EVENT_TYPE_VALUES = [
  'station.building.upgrade.finalize.v1',
  'station.mining.rig.arrived.v1',
  'station.mining.rig.returned.v1',
] as const

export type JournalDateRange = (typeof JOURNAL_DATE_RANGE_VALUES)[number]
export type JournalImportance = (typeof JOURNAL_IMPORTANCE_VALUES)[number]
export type JournalEventType = (typeof JOURNAL_EVENT_TYPE_VALUES)[number]

export type JournalEventsCursor = {
  occurredAt: Date
  id: string
}

type JournalEventsQuery = {
  dateRange?: JournalDateRange
  importance?: JournalImportance[]
  eventTypes?: JournalEventType[]
  cursor?: JournalEventsCursor | null
  now?: Date
}

type CreateJournalEntryInput = {
  stationId: string
  playerId?: string
  eventType: string
  importance: JournalImportance
  description: string
  occurredAt: Date
  metadataJson?: Record<string, unknown>
}

export async function getJournalEventsForPlayer(
  services: AppServices,
  playerId: string,
  query: JournalEventsQuery = {},
): Promise<JournalEventsResponse> {
  const effectiveDateRange = query.dateRange ?? 'all'
  const now = query.now ?? new Date()
  const conditions = [eq(playerJournalEntries.playerId, playerId)]
  const rangeStart = resolveJournalDateRangeStart(effectiveDateRange, now)

  if (rangeStart) {
    conditions.push(gte(playerJournalEntries.occurredAt, rangeStart))
  }

  if (query.importance && query.importance.length > 0) {
    conditions.push(inArray(playerJournalEntries.importance, query.importance))
  }

  if (query.eventTypes && query.eventTypes.length > 0) {
    conditions.push(inArray(playerJournalEntries.eventType, query.eventTypes))
  }

  if (query.cursor) {
    conditions.push(
      or(
        lt(playerJournalEntries.occurredAt, query.cursor.occurredAt),
        and(
          eq(playerJournalEntries.occurredAt, query.cursor.occurredAt),
          lt(playerJournalEntries.id, query.cursor.id),
        ),
      )!,
    )
  }

  const journalRows = await services.db
    .select({
      id: playerJournalEntries.id,
      eventType: playerJournalEntries.eventType,
      importance: playerJournalEntries.importance,
      description: playerJournalEntries.description,
      occurredAt: playerJournalEntries.occurredAt,
    })
    .from(playerJournalEntries)
    .where(and(...conditions))
    .orderBy(desc(playerJournalEntries.occurredAt), desc(playerJournalEntries.id))
    .limit(PLAYER_JOURNAL_PAGE_SIZE + 1)

  const hasMore = journalRows.length > PLAYER_JOURNAL_PAGE_SIZE
  const visibleRows = journalRows.slice(0, PLAYER_JOURNAL_PAGE_SIZE)
  const lastVisibleRow = visibleRows.at(-1)

  return {
    events: visibleRows.map((row) => ({
      id: row.id,
      event_type: row.eventType,
      importance: row.importance,
      description: row.description,
      occurred_at: row.occurredAt.toISOString(),
    })),
    next_cursor:
      hasMore && lastVisibleRow
        ? encodeJournalCursor({
            occurredAt: lastVisibleRow.occurredAt,
            id: lastVisibleRow.id,
          })
        : null,
  }
}

export function encodeJournalCursor(cursor: JournalEventsCursor): string {
  return Buffer.from(
    JSON.stringify({
      occurred_at: cursor.occurredAt.toISOString(),
      id: cursor.id,
    }),
    'utf8',
  ).toString('base64url')
}

export function decodeJournalCursor(rawCursor: string): JournalEventsCursor {
  let payload: unknown

  try {
    payload = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'))
  } catch {
    throw new Error('invalid_cursor')
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as Record<string, unknown>).occurred_at !== 'string' ||
    typeof (payload as Record<string, unknown>).id !== 'string'
  ) {
    throw new Error('invalid_cursor')
  }

  const occurredAt = new Date((payload as Record<string, string>).occurred_at)
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error('invalid_cursor')
  }

  return {
    occurredAt,
    id: (payload as Record<string, string>).id,
  }
}

function resolveJournalDateRangeStart(dateRange: JournalDateRange, now: Date): Date | null {
  if (dateRange === 'all') {
    return null
  }

  const durationMs =
    dateRange === '24h'
      ? 24 * 60 * 60 * 1000
      : dateRange === '7d'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000

  return new Date(now.getTime() - durationMs)
}

export async function createPlayerJournalEntry(
  tx: any,
  input: CreateJournalEntryInput,
): Promise<void> {
  const playerId =
    input.playerId ??
    (
      await tx
        .select({
          playerId: stations.playerId,
        })
        .from(stations)
        .where(eq(stations.id, input.stationId))
        .limit(1)
    )[0]?.playerId

  if (!playerId) {
    return
  }

  await tx.insert(playerJournalEntries).values({
    playerId,
    stationId: input.stationId,
    eventType: input.eventType,
    importance: input.importance,
    description: input.description,
    occurredAt: input.occurredAt,
    metadataJson: input.metadataJson ?? {},
  })
}

export async function resolveBuildingDisplayName(buildingType: string): Promise<string> {
  const buildingNames = await loadBuildingNamesById()
  return buildingNames.get(buildingType) ?? buildingType
}

export async function resolveResourceDisplayName(resourceKey: string): Promise<string> {
  const resourceNames = await loadResourceNamesById()
  return resourceNames.get(resourceKey) ?? resourceKey
}

export async function formatJournalResourceList(
  resources: Iterable<[string, number]>,
): Promise<string> {
  const resourceNames = await loadResourceNamesById()
  const segments = [...resources]
    .filter(([, amount]) => amount > 0)
    .map(([resourceKey, amount]) => ({
      resourceKey,
      resourceName: resourceNames.get(resourceKey) ?? resourceKey,
      amount,
    }))
    .sort((left, right) => {
      const nameCompare = left.resourceName.localeCompare(right.resourceName)
      if (nameCompare !== 0) {
        return nameCompare
      }

      return left.resourceKey.localeCompare(right.resourceKey)
    })
    .map((resource) => `${resource.resourceName} x${resource.amount}`)

  return segments.join(', ')
}
