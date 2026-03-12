import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StationContext } from '../station/StationProvider'
import {
  JournalNotificationsProvider,
  useJournalNotifications,
} from './JournalNotificationsProvider'

function buildStationState(overrides: Record<string, unknown> = {}) {
  return {
    snapshotRefreshRevision: 0,
    ...overrides,
  } as any
}

function NotificationHarness() {
  const { notifications, dismissNotification } = useJournalNotifications()

  return (
    <div>
      {notifications.map((notification) => (
        <article key={notification.id}>
          <span>{notification.description}</span>
          <button
            type="button"
            onClick={() => {
              dismissNotification(notification.id)
            }}
          >
            dismiss {notification.id}
          </button>
        </article>
      ))}
    </div>
  )
}

describe('JournalNotificationsProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('seeds from the latest journal entry without showing a banner, then stacks new completions across pages', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'seed-anchor',
              event_type: 'station.building.upgrade.finalize.v1',
              importance: 'important',
              description: 'Storage upgraded to level 2!',
              occurred_at: '2026-03-12T16:30:05.000Z',
            },
          ],
          next_cursor: null,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'event-3',
              event_type: 'station.mining.rig.returned.v1',
              importance: 'important',
              description: 'Mining rig returned with full cargo: Metals x12, Water x3!',
              occurred_at: '2026-03-12T17:30:05.000Z',
            },
            {
              id: 'event-2',
              event_type: 'station.mining.rig.arrived.v1',
              importance: 'warning',
              description: 'Mining rig arrived on an occupied destination!',
              occurred_at: '2026-03-12T17:20:05.000Z',
            },
          ],
          next_cursor: 'cursor-page-2',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'event-1',
              event_type: 'station.mining.rig.arrived.v1',
              importance: 'info',
              description: 'Mining rig arrived at destination',
              occurred_at: '2026-03-12T17:10:05.000Z',
            },
            {
              id: 'seed-anchor',
              event_type: 'station.building.upgrade.finalize.v1',
              importance: 'important',
              description: 'Storage upgraded to level 2!',
              occurred_at: '2026-03-12T16:30:05.000Z',
            },
          ],
          next_cursor: null,
        }),
      } as Response)

    const { rerender } = render(
      <StationContext.Provider value={buildStationState()}>
        <JournalNotificationsProvider>
          <NotificationHarness />
        </JournalNotificationsProvider>
      </StationContext.Provider>,
    )

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/storage upgraded to level 2!/i)).not.toBeInTheDocument()

    rerender(
      <StationContext.Provider value={buildStationState({ snapshotRefreshRevision: 1 })}>
        <JournalNotificationsProvider>
          <NotificationHarness />
        </JournalNotificationsProvider>
      </StationContext.Provider>,
    )

    expect(
      await screen.findByText(/mining rig returned with full cargo: metals x12, water x3!/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/mining rig arrived on an occupied destination!/i)).toBeInTheDocument()
    expect(screen.getByText(/mining rig arrived at destination/i)).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('auto-dismisses banners after eight seconds and supports manual dismiss', async () => {
    vi.useFakeTimers()

    vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [],
          next_cursor: null,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'event-1',
              event_type: 'station.building.upgrade.finalize.v1',
              importance: 'important',
              description: 'Storage upgraded to level 3!',
              occurred_at: '2026-03-12T18:30:05.000Z',
            },
            {
              id: 'event-2',
              event_type: 'station.mining.rig.arrived.v1',
              importance: 'warning',
              description: 'Mining rig arrived on an occupied destination!',
              occurred_at: '2026-03-12T18:20:05.000Z',
            },
          ],
          next_cursor: null,
        }),
      } as Response)

    const { rerender } = render(
      <StationContext.Provider value={buildStationState()}>
        <JournalNotificationsProvider>
          <NotificationHarness />
        </JournalNotificationsProvider>
      </StationContext.Provider>,
    )

    rerender(
      <StationContext.Provider value={buildStationState({ snapshotRefreshRevision: 1 })}>
        <JournalNotificationsProvider>
          <NotificationHarness />
        </JournalNotificationsProvider>
      </StationContext.Provider>,
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText(/storage upgraded to level 3!/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /dismiss event-2/i }))
    expect(
      screen.queryByText(/mining rig arrived on an occupied destination!/i),
    ).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(8_000)
      await Promise.resolve()
    })

    expect(screen.queryByText(/storage upgraded to level 3!/i)).not.toBeInTheDocument()
  })
})
