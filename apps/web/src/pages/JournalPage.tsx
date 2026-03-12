import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchJournalEvents } from '../features/journal/api'
import type {
  JournalDateRange,
  JournalEventRow,
  JournalEventType,
  JournalFilters,
  JournalImportance,
} from '../types/app'

const journalPageClassName =
  'relative overflow-hidden rounded-[28px] border border-slate-300/20 bg-[linear-gradient(160deg,rgba(5,10,18,0.96),rgba(13,22,30,0.9))] shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-md'
const journalPanelClassName =
  'rounded-2xl border border-slate-300/12 bg-slate-950/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
const filterChipBaseClassName =
  'rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60'

const defaultJournalFilters: JournalFilters = {
  dateRange: 'all',
  importance: [],
  eventTypes: [],
}

const dateRangeOptions: Array<{ value: JournalDateRange; label: string }> = [
  { value: 'all', label: 'All' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
]

const importanceOptions: Array<{ value: JournalImportance; label: string }> = [
  { value: 'info', label: 'Info' },
  { value: 'important', label: 'Important' },
  { value: 'warning', label: 'Warning' },
]

const eventTypeOptions: Array<{ value: JournalEventType; label: string }> = [
  { value: 'station.building.upgrade.finalize.v1', label: 'Upgrade' },
  { value: 'station.mining.rig.arrived.v1', label: 'Mining' },
  { value: 'station.mining.rig.returned.v1', label: 'Return' },
]

const importanceThemeByValue: Record<
  JournalImportance,
  {
    marker: string
    badge: string
    timestamp: string
  }
> = {
  info: {
    marker: 'bg-slate-200 shadow-[0_0_18px_rgba(226,232,240,0.22)]',
    badge: 'border-slate-200/20 bg-slate-200/10 text-slate-100',
    timestamp: 'text-slate-400',
  },
  important: {
    marker: 'bg-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.35)]',
    badge: 'border-sky-300/30 bg-sky-400/12 text-sky-200',
    timestamp: 'text-sky-200/80',
  },
  warning: {
    marker: 'bg-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.35)]',
    badge: 'border-amber-300/30 bg-amber-400/12 text-amber-200',
    timestamp: 'text-amber-200/80',
  },
}

function formatOccurredAtParts(occurredAt: string): { date: string; time: string } {
  const parsedAt = new Date(occurredAt)
  if (Number.isNaN(parsedAt.getTime())) {
    return {
      date: occurredAt,
      time: '',
    }
  }

  return {
    date: new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(parsedAt),
    time: new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(parsedAt),
  }
}

function journalCategoryLabel(eventType: string): string {
  const matchingOption = eventTypeOptions.find((option) => option.value === eventType)
  return matchingOption?.label ?? 'Archive'
}

function formatFilterSummary(filters: JournalFilters): string {
  const segments: string[] = []

  if (filters.dateRange !== 'all') {
    const selectedDateRange = dateRangeOptions.find((option) => option.value === filters.dateRange)
    if (selectedDateRange) {
      segments.push(selectedDateRange.label)
    }
  }

  if (filters.importance.length > 0) {
    segments.push(
      filters.importance
        .map(
          (importance) =>
            importanceOptions.find((option) => option.value === importance)?.label ?? importance,
        )
        .join(' + '),
    )
  }

  if (filters.eventTypes.length > 0) {
    segments.push(
      filters.eventTypes
        .map(
          (eventType) =>
            eventTypeOptions.find((option) => option.value === eventType)?.label ?? eventType,
        )
        .join(' + '),
    )
  }

  return segments.length > 0 ? segments.join(', ') : 'All recorded transmissions'
}

function hasActiveFilters(filters: JournalFilters): boolean {
  return (
    filters.dateRange !== defaultJournalFilters.dateRange ||
    filters.importance.length > 0 ||
    filters.eventTypes.length > 0
  )
}

function mergeJournalEvents(
  existingEvents: JournalEventRow[],
  incomingEvents: JournalEventRow[],
): JournalEventRow[] {
  const mergedEvents = [...existingEvents]
  const seenEventIds = new Set(existingEvents.map((event) => event.id))

  for (const event of incomingEvents) {
    if (seenEventIds.has(event.id)) {
      continue
    }

    mergedEvents.push(event)
    seenEventIds.add(event.id)
  }

  return mergedEvents
}

function toggleSelection<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]
}

function JournalHeader({
  eventCount,
  filterSummary,
}: {
  eventCount: number
  filterSummary: string
}) {
  return (
    <header className="relative overflow-hidden rounded-t-[28px] border-b border-slate-300/12 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_28%)] px-5 py-5 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 font-mono text-[11px] uppercase tracking-[0.32em] text-slate-400">
            Station Archive
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[0.08em] text-slate-50 sm:text-3xl">
            Journal
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Recovered station activity log. Recent transmissions are preserved here for review.
          </p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
            Filtered archive: {filterSummary}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-300/12 bg-slate-950/45 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <p className="m-0 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
            Archive Window
          </p>
          <p className="mt-2 text-sm text-slate-200">Showing latest {eventCount} entries</p>
        </div>
      </div>
    </header>
  )
}

function JournalFilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${filterChipBaseClassName} ${
        active
          ? 'border-sky-300/35 bg-sky-400/12 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.18)]'
          : 'border-slate-300/10 bg-slate-950/55 text-slate-400 hover:border-slate-300/20 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  )
}

function JournalToolbarShell({
  filters,
  onDateRangeChange,
  onToggleImportance,
  onToggleEventType,
  onClearFilters,
}: {
  filters: JournalFilters
  onDateRangeChange: (value: JournalDateRange) => void
  onToggleImportance: (value: JournalImportance) => void
  onToggleEventType: (value: JournalEventType) => void
  onClearFilters: () => void
}) {
  return (
    <section
      aria-label="Journal toolbar"
      className="mx-5 mt-5 rounded-2xl border border-slate-300/10 bg-slate-900/35 px-4 py-4 sm:mx-7"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
            Filter Deck
          </span>
          <button
            type="button"
            onClick={onClearFilters}
            disabled={!hasActiveFilters(filters)}
            className="rounded-full border border-slate-300/10 bg-slate-950/55 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-300/20 hover:text-slate-50 disabled:opacity-40"
          >
            Clear filters
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Date range
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {dateRangeOptions.map((option) => (
                <JournalFilterChip
                  key={option.value}
                  label={option.label}
                  active={filters.dateRange === option.value}
                  onClick={() => {
                    onDateRangeChange(option.value)
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Importance
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {importanceOptions.map((option) => (
                <JournalFilterChip
                  key={option.value}
                  label={option.label}
                  active={filters.importance.includes(option.value)}
                  onClick={() => {
                    onToggleImportance(option.value)
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Type
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {eventTypeOptions.map((option) => (
                <JournalFilterChip
                  key={option.value}
                  label={option.label}
                  active={filters.eventTypes.includes(option.value)}
                  onClick={() => {
                    onToggleEventType(option.value)
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function JournalSkeletonList() {
  return (
    <div className="grid gap-3" aria-label="Journal loading state">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={`journal-skeleton-${index}`} className={`${journalPanelClassName} p-4 sm:p-5`}>
          <div className="flex gap-4">
            <div className="mt-1 h-14 w-1 rounded-full bg-slate-700/70" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-20 rounded-full bg-slate-700/60" />
              <div className="mt-3 h-4 w-11/12 rounded-full bg-slate-800/80" />
              <div className="mt-2 h-4 w-8/12 rounded-full bg-slate-800/60" />
            </div>
            <div className="hidden w-28 shrink-0 sm:block">
              <div className="ml-auto h-4 w-20 rounded-full bg-slate-700/60" />
              <div className="mt-2 ml-auto h-5 w-16 rounded-full bg-slate-800/70" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function JournalStatePanel({
  title,
  description,
  toneClassName,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  toneClassName: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <section className={`${journalPanelClassName} px-5 py-6 text-center sm:px-6`}>
      <p className={`m-0 font-mono text-[11px] uppercase tracking-[0.28em] ${toneClassName}`}>
        Archive Notice
      </p>
      <h3 className="mt-3 text-xl text-slate-100">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-full border border-slate-200/15 bg-slate-100/6 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-100/12"
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}

function JournalEventCard({ event }: { event: JournalEventRow }) {
  const theme = importanceThemeByValue[event.importance]
  const occurredAt = formatOccurredAtParts(event.occurredAt)
  const categoryLabel = journalCategoryLabel(event.eventType)

  return (
    <li className={`${journalPanelClassName} px-4 py-4 sm:px-5 sm:py-5`}>
      <article className="flex items-start gap-4">
        <div className="flex shrink-0 flex-col items-center">
          <div aria-hidden="true" className={`h-16 w-1 rounded-full ${theme.marker} sm:h-20`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] ${theme.badge}`}
            >
              {categoryLabel}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Archived transmission
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-100 sm:text-[15px]">
            {event.description}
          </p>
          <div className="mt-3 flex items-center gap-2 sm:hidden">
            <span
              className={`font-mono text-[11px] uppercase tracking-[0.18em] ${theme.timestamp}`}
            >
              {occurredAt.date}
            </span>
            <span className="text-slate-600">/</span>
            <span className="font-mono text-sm text-slate-200">{occurredAt.time}</span>
          </div>
        </div>
        <aside
          aria-label="Journal timestamp"
          className="hidden w-32 shrink-0 border-l border-slate-300/10 pl-4 text-right sm:block"
        >
          <p className={`m-0 font-mono text-[11px] uppercase tracking-[0.18em] ${theme.timestamp}`}>
            {occurredAt.date}
          </p>
          <p className="mt-2 font-mono text-base text-slate-100">{occurredAt.time}</p>
        </aside>
      </article>
    </li>
  )
}

function JournalEventList({ events }: { events: JournalEventRow[] }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0" aria-label="Journal events list">
      {events.map((event) => (
        <JournalEventCard key={event.id} event={event} />
      ))}
    </ul>
  )
}

function JournalPaginationPanel({
  hasMore,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
}: {
  hasMore: boolean
  isLoadingMore: boolean
  loadMoreError: string | null
  onLoadMore: () => void
}) {
  return (
    <div className="mt-5">
      {loadMoreError ? (
        <div
          className={`${journalPanelClassName} mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3`}
        >
          <p className="m-0 text-sm text-red-200/90">{loadMoreError}</p>
          <button
            type="button"
            onClick={onLoadMore}
            className="rounded-full border border-red-300/20 bg-red-400/10 px-4 py-2 text-sm text-red-100 transition hover:bg-red-400/16"
          >
            Retry load more
          </button>
        </div>
      ) : null}
      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-full border border-slate-300/14 bg-slate-900/60 px-5 py-2.5 text-sm text-slate-100 transition hover:border-slate-300/24 hover:bg-slate-900/75"
          >
            {isLoadingMore ? 'Recovering older transmissions...' : 'Load more'}
          </button>
        </div>
      ) : (
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
          End of recovered log
        </p>
      )}
    </div>
  )
}

export function JournalPage() {
  const [filters, setFilters] = useState<JournalFilters>(defaultJournalFilters)
  const [events, setEvents] = useState<JournalEventRow[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const requestVersionRef = useRef(0)

  const filterSummary = useMemo(() => formatFilterSummary(filters), [filters])
  const activeFilters = hasActiveFilters(filters)

  async function loadFirstPage(nextFilters: JournalFilters) {
    const requestVersion = ++requestVersionRef.current
    setStatus('loading')
    setLoadMoreError(null)
    setNextCursor(null)

    try {
      const journalPage = await fetchJournalEvents(nextFilters)
      if (requestVersion !== requestVersionRef.current) {
        return
      }

      setEvents(journalPage.events)
      setNextCursor(journalPage.nextCursor)
      setStatus(journalPage.events.length > 0 ? 'ready' : 'empty')
    } catch {
      if (requestVersion !== requestVersionRef.current) {
        return
      }

      setEvents([])
      setNextCursor(null)
      setLoadMoreError(null)
      setStatus('error')
    }
  }

  async function loadMoreJournalEvents() {
    if (!nextCursor || isLoadingMore) {
      return
    }

    const requestVersion = requestVersionRef.current
    const cursor = nextCursor
    setIsLoadingMore(true)
    setLoadMoreError(null)

    try {
      const journalPage = await fetchJournalEvents(filters, cursor)
      if (requestVersion !== requestVersionRef.current) {
        return
      }

      setEvents((currentEvents) => mergeJournalEvents(currentEvents, journalPage.events))
      setNextCursor(journalPage.nextCursor)
    } catch {
      if (requestVersion !== requestVersionRef.current) {
        return
      }

      setLoadMoreError('The archive could not recover older transmissions. Try again.')
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsLoadingMore(false)
      }
    }
  }

  useEffect(() => {
    void loadFirstPage(filters)
  }, [filters])

  return (
    <section aria-label="Journal page" className={journalPageClassName}>
      <JournalHeader eventCount={20} filterSummary={filterSummary} />
      <JournalToolbarShell
        filters={filters}
        onDateRangeChange={(value) => {
          setFilters((currentFilters) => ({ ...currentFilters, dateRange: value }))
        }}
        onToggleImportance={(value) => {
          setFilters((currentFilters) => ({
            ...currentFilters,
            importance: toggleSelection(currentFilters.importance, value),
          }))
        }}
        onToggleEventType={(value) => {
          setFilters((currentFilters) => ({
            ...currentFilters,
            eventTypes: toggleSelection(currentFilters.eventTypes, value),
          }))
        }}
        onClearFilters={() => {
          setFilters(defaultJournalFilters)
        }}
      />
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        {status === 'loading' ? <JournalSkeletonList /> : null}
        {status === 'empty' ? (
          <JournalStatePanel
            title={activeFilters ? 'No matching archived events' : 'No archived events yet'}
            description={
              activeFilters
                ? 'No completed transmissions match the current archive filters. Adjust the filter deck to widen the recovered log.'
                : 'Your station has not recorded any completed transmissions. Once upgrades finish or rigs report back, the archive will populate here.'
            }
            toneClassName="text-slate-500"
          />
        ) : null}
        {status === 'error' ? (
          <JournalStatePanel
            title="Archive link unavailable"
            description="The station could not recover its recent transmissions. Try reloading the journal to re-establish the archive feed."
            toneClassName="text-red-300/80"
            actionLabel="Reload journal"
            onAction={() => {
              void loadFirstPage(filters)
            }}
          />
        ) : null}
        {status === 'ready' ? (
          <>
            <JournalEventList events={events} />
            <JournalPaginationPanel
              hasMore={nextCursor !== null}
              isLoadingMore={isLoadingMore}
              loadMoreError={loadMoreError}
              onLoadMore={() => {
                void loadMoreJournalEvents()
              }}
            />
          </>
        ) : null}
      </div>
    </section>
  )
}
