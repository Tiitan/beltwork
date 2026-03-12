import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { fetchJournalEvents } from './api'
import { useStation } from '../station/useStation'
import type {
  JournalBannerNotification,
  JournalEventRow,
  JournalFilters,
  JournalImportance,
} from '../../types/app'

const COMPLETION_BANNER_VISIBLE_MS = 8_000

const defaultJournalFilters: JournalFilters = {
  dateRange: 'all',
  importance: [],
  eventTypes: [],
}

type JournalNotificationsContextValue = {
  notifications: JournalBannerNotification[]
  dismissNotification: (notificationId: string) => void
}

export const JournalNotificationsContext = createContext<JournalNotificationsContextValue | null>(
  null,
)

type JournalNotificationsProviderProps = {
  children: ReactNode
}

type JournalAnchor = {
  id: string
}

export function JournalNotificationsProvider({ children }: JournalNotificationsProviderProps) {
  const { snapshotRefreshRevision } = useStation()
  const [notifications, setNotifications] = useState<JournalBannerNotification[]>([])
  const latestAnchorRef = useRef<JournalAnchor | null>(null)
  const shownNotificationIdsRef = useRef<Set<string>>(new Set())
  const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [isSeeded, setIsSeeded] = useState(false)
  const requestVersionRef = useRef(0)

  function dismissNotification(notificationId: string) {
    const timer = dismissTimersRef.current.get(notificationId)
    if (timer) {
      clearTimeout(timer)
      dismissTimersRef.current.delete(notificationId)
    }

    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.id !== notificationId),
    )
  }

  function queueNotifications(events: JournalEventRow[]) {
    if (events.length === 0) {
      return
    }

    const pendingNotifications: JournalBannerNotification[] = []
    const nowMs = Date.now()

    for (const event of events) {
      if (shownNotificationIdsRef.current.has(event.id)) {
        continue
      }

      shownNotificationIdsRef.current.add(event.id)
      pendingNotifications.push({
        ...event,
        expiresAt: nowMs + COMPLETION_BANNER_VISIBLE_MS,
      })
    }

    if (pendingNotifications.length === 0) {
      return
    }

    setNotifications((currentNotifications) => [...pendingNotifications, ...currentNotifications])

    for (const notification of pendingNotifications) {
      const timer = setTimeout(
        () => {
          dismissNotification(notification.id)
        },
        Math.max(0, notification.expiresAt - Date.now()),
      )

      dismissTimersRef.current.set(notification.id, timer)
    }
  }

  useEffect(() => {
    let isMounted = true
    const requestVersion = ++requestVersionRef.current

    async function seedLatestAnchor() {
      try {
        const firstPage = await fetchJournalEvents(defaultJournalFilters)
        if (!isMounted || requestVersion !== requestVersionRef.current) {
          return
        }

        latestAnchorRef.current = firstPage.events[0] ? { id: firstPage.events[0].id } : null
      } catch {
        if (!isMounted || requestVersion !== requestVersionRef.current) {
          return
        }

        latestAnchorRef.current = null
      } finally {
        if (isMounted && requestVersion === requestVersionRef.current) {
          setIsSeeded(true)
        }
      }
    }

    void seedLatestAnchor()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isSeeded || snapshotRefreshRevision === 0) {
      return
    }

    let isMounted = true
    const requestVersion = ++requestVersionRef.current

    async function loadCompletionsSinceAnchor() {
      try {
        const previousAnchor = latestAnchorRef.current
        let cursor: string | null = null
        let newestEventId: string | null = null
        const candidateEvents: JournalEventRow[] = []

        while (true) {
          const page = await fetchJournalEvents(defaultJournalFilters, cursor)
          if (!isMounted || requestVersion !== requestVersionRef.current) {
            return
          }

          if (!newestEventId && page.events[0]) {
            newestEventId = page.events[0].id
          }

          if (previousAnchor) {
            const anchorIndex = page.events.findIndex((event) => event.id === previousAnchor.id)
            if (anchorIndex >= 0) {
              candidateEvents.push(...page.events.slice(0, anchorIndex))
              break
            }
          }

          candidateEvents.push(...page.events)

          if (!page.nextCursor) {
            break
          }

          cursor = page.nextCursor
        }

        if (!isMounted || requestVersion !== requestVersionRef.current) {
          return
        }

        if (newestEventId) {
          latestAnchorRef.current = { id: newestEventId }
        }

        queueNotifications(candidateEvents)
      } catch {
        return
      }
    }

    void loadCompletionsSinceAnchor()

    return () => {
      isMounted = false
    }
  }, [isSeeded, snapshotRefreshRevision])

  useEffect(() => {
    return () => {
      for (const timer of dismissTimersRef.current.values()) {
        clearTimeout(timer)
      }
      dismissTimersRef.current.clear()
    }
  }, [])

  return (
    <JournalNotificationsContext.Provider value={{ notifications, dismissNotification }}>
      {children}
    </JournalNotificationsContext.Provider>
  )
}

export function useJournalNotifications() {
  const context = useContext(JournalNotificationsContext)
  if (context === null) {
    throw new Error('useJournalNotifications must be used within JournalNotificationsProvider')
  }

  return context
}

export function journalBannerTheme(importance: JournalImportance): {
  accent: string
  badge: string
  card: string
} {
  if (importance === 'important') {
    return {
      accent: 'bg-sky-400 shadow-[0_0_22px_rgba(56,189,248,0.32)]',
      badge: 'border-sky-300/35 bg-sky-400/12 text-sky-100',
      card: 'border-sky-300/18 bg-[linear-gradient(160deg,rgba(8,19,36,0.98),rgba(10,24,45,0.94))]',
    }
  }

  if (importance === 'warning') {
    return {
      accent: 'bg-amber-400 shadow-[0_0_22px_rgba(251,191,36,0.32)]',
      badge: 'border-amber-300/35 bg-amber-400/12 text-amber-100',
      card: 'border-amber-300/18 bg-[linear-gradient(160deg,rgba(33,19,7,0.98),rgba(44,27,10,0.94))]',
    }
  }

  return {
    accent: 'bg-slate-200 shadow-[0_0_18px_rgba(226,232,240,0.22)]',
    badge: 'border-slate-200/25 bg-slate-200/10 text-slate-100',
    card: 'border-slate-300/18 bg-[linear-gradient(160deg,rgba(11,18,28,0.98),rgba(17,26,38,0.94))]',
  }
}

export function journalNotificationCategoryLabel(eventType: string): string {
  if (eventType === 'station.building.upgrade.finalize.v1') {
    return 'Upgrade'
  }

  if (eventType === 'station.mining.rig.arrived.v1') {
    return 'Mining'
  }

  if (eventType === 'station.mining.rig.returned.v1') {
    return 'Return'
  }

  return 'Archive'
}
