import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import type { AppServices } from '../types/api.js'
import {
  DEFAULT_STATION_LOCK_LEASE_MS,
  prefetchDueEventsWindow,
  processDueDomainEventById,
} from './domain-events.service.js'

const DOMAIN_EVENTS_POLL_INTERVAL_MS = 10_000
const DOMAIN_EVENTS_WINDOW_MS = 10_000
const DOMAIN_EVENTS_LOCK_RETRY_MS = 1_000
const DOMAIN_EVENTS_BATCH_LIMIT = 200

type QueuedEvent = {
  id: string
  dueAtMs: number
}

type DomainEventsAgentOptions = {
  pollIntervalMs?: number
  windowMs?: number
  lockRetryMs?: number
  batchLimit?: number
  lockLeaseMs?: number
  agentId?: string
}

function nextAgentId(): string {
  return `${hostname()}:${process.pid}:${randomUUID()}`
}

export function startDomainEventsAgent(
  services: AppServices,
  options: DomainEventsAgentOptions = {},
) {
  const pollIntervalMs = options.pollIntervalMs ?? DOMAIN_EVENTS_POLL_INTERVAL_MS
  const windowMs = options.windowMs ?? DOMAIN_EVENTS_WINDOW_MS
  const lockRetryMs = options.lockRetryMs ?? DOMAIN_EVENTS_LOCK_RETRY_MS
  const batchLimit = options.batchLimit ?? DOMAIN_EVENTS_BATCH_LIMIT
  const lockLeaseMs = options.lockLeaseMs ?? DEFAULT_STATION_LOCK_LEASE_MS
  const agentId = options.agentId ?? nextAgentId()

  const queuedEventsById = new Map<string, QueuedEvent>()
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let executionTimer: ReturnType<typeof setTimeout> | null = null
  let isPolling = false
  let isDraining = false
  let isStopped = false

  function enqueueEvent(eventId: string, dueAt: Date) {
    const dueAtMs = dueAt.getTime()
    const existing = queuedEventsById.get(eventId)
    if (!existing || dueAtMs < existing.dueAtMs) {
      queuedEventsById.set(eventId, { id: eventId, dueAtMs })
    }
  }

  function requeueWithDelay(eventId: string, delayMs: number) {
    queuedEventsById.set(eventId, {
      id: eventId,
      dueAtMs: Date.now() + delayMs,
    })
  }

  function scheduleNextDueExecution() {
    if (isStopped) {
      return
    }

    if (executionTimer) {
      clearTimeout(executionTimer)
      executionTimer = null
    }

    if (queuedEventsById.size === 0) {
      return
    }

    let earliestDueAtMs = Number.POSITIVE_INFINITY
    for (const queuedEvent of queuedEventsById.values()) {
      earliestDueAtMs = Math.min(earliestDueAtMs, queuedEvent.dueAtMs)
    }

    const delayMs = Math.max(0, earliestDueAtMs - Date.now())
    executionTimer = setTimeout(() => {
      void drainDueEvents()
    }, delayMs)
    executionTimer.unref?.()
  }

  async function pollDueEventsWindow() {
    if (isStopped || isPolling) {
      return
    }

    isPolling = true
    try {
      const now = new Date()
      const dueBefore = new Date(now.getTime() + windowMs)
      const dueEvents = await prefetchDueEventsWindow(services, now, dueBefore, batchLimit)

      for (const dueEvent of dueEvents) {
        enqueueEvent(dueEvent.id, dueEvent.dueAt)
      }

      scheduleNextDueExecution()
    } catch (error) {
      console.error('domain_events_agent_poll_failed', error)
    } finally {
      isPolling = false
    }
  }

  async function drainDueEvents() {
    if (isStopped || isDraining) {
      return
    }

    isDraining = true
    try {
      const nowMs = Date.now()
      const dueEvents = [...queuedEventsById.values()]
        .filter((event) => event.dueAtMs <= nowMs)
        .sort((a, b) => a.dueAtMs - b.dueAtMs)

      for (const dueEvent of dueEvents) {
        queuedEventsById.delete(dueEvent.id)

        const result = await processDueDomainEventById(services, dueEvent.id, new Date(), {
          lockedBy: agentId,
          lockLeaseMs,
        })

        if (result === 'lock_contended') {
          requeueWithDelay(dueEvent.id, lockRetryMs)
        }
      }
    } catch (error) {
      console.error('domain_events_agent_drain_failed', error)
    } finally {
      isDraining = false
      scheduleNextDueExecution()
    }
  }

  pollTimer = setInterval(() => {
    void pollDueEventsWindow()
  }, pollIntervalMs)
  pollTimer.unref?.()
  void pollDueEventsWindow()

  return () => {
    isStopped = true

    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }

    if (executionTimer) {
      clearTimeout(executionTimer)
      executionTimer = null
    }
  }
}
