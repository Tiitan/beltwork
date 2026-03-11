import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppServices } from '../types/api.js'

vi.mock('./domain-events.service.js', () => ({
  prefetchDueEventsWindow: vi.fn(),
  processDueDomainEventById: vi.fn(),
  DEFAULT_STATION_LOCK_LEASE_MS: 30_000,
}))

import { startDomainEventsAgent } from './domain-events-agent.service.js'
import { prefetchDueEventsWindow, processDueDomainEventById } from './domain-events.service.js'

describe('startDomainEventsAgent', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-11T18:00:00.000Z'))
    vi.mocked(prefetchDueEventsWindow).mockResolvedValue([])
    vi.mocked(processDueDomainEventById).mockResolvedValue('processed')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('prefetches 10-second windows and executes events at due time', async () => {
    const services = {} as AppServices
    const firstDueAt = new Date(Date.now() + 5_000)

    vi.mocked(prefetchDueEventsWindow)
      .mockResolvedValueOnce([{ id: 'event-1', dueAt: firstDueAt }])
      .mockResolvedValue([])

    const stopAgent = startDomainEventsAgent(services, {
      pollIntervalMs: 10_000,
      windowMs: 10_000,
      agentId: 'agent-test',
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(vi.mocked(prefetchDueEventsWindow)).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(4_999)
    expect(vi.mocked(processDueDomainEventById)).toHaveBeenCalledTimes(0)

    await vi.advanceTimersByTimeAsync(1)
    expect(vi.mocked(processDueDomainEventById)).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(vi.mocked(prefetchDueEventsWindow)).toHaveBeenCalledTimes(2)

    stopAgent()
  })

  it('deduplicates queued events across polls before execution', async () => {
    const services = {} as AppServices
    const dueAt = new Date(Date.now() + 4_000)
    let pollCount = 0

    vi.mocked(prefetchDueEventsWindow).mockImplementation(async () => {
      pollCount += 1
      if (pollCount <= 3) {
        return [{ id: 'event-dedup', dueAt }]
      }
      return []
    })

    const stopAgent = startDomainEventsAgent(services, {
      pollIntervalMs: 1_000,
      windowMs: 10_000,
      agentId: 'agent-test',
    })

    await vi.advanceTimersByTimeAsync(6_000)

    expect(vi.mocked(processDueDomainEventById)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(processDueDomainEventById)).toHaveBeenCalledWith(
      services,
      'event-dedup',
      expect.any(Date),
      expect.objectContaining({ lockedBy: 'agent-test' }),
    )

    stopAgent()
  })

  it('requeues lock-contended events and retries after short delay', async () => {
    const services = {} as AppServices

    vi.mocked(prefetchDueEventsWindow).mockResolvedValueOnce([
      {
        id: 'event-lock',
        dueAt: new Date(Date.now()),
      },
    ])
    vi.mocked(processDueDomainEventById)
      .mockResolvedValueOnce('lock_contended')
      .mockResolvedValueOnce('processed')

    const stopAgent = startDomainEventsAgent(services, {
      pollIntervalMs: 10_000,
      windowMs: 10_000,
      lockRetryMs: 1_000,
      agentId: 'agent-test',
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(vi.mocked(processDueDomainEventById)).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(999)
    expect(vi.mocked(processDueDomainEventById)).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(vi.mocked(processDueDomainEventById)).toHaveBeenCalledTimes(2)

    stopAgent()
  })
})
