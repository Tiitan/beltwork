import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JournalPage } from './JournalPage'

describe('JournalPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the immersive archive header and event cards', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          {
            id: 'journal-1',
            event_type: 'station.mining.rig.returned.v1',
            importance: 'important',
            description: 'Mining rig returned with full cargo: Metals x12, Water x3!',
            occurred_at: '2026-03-12T17:01:05.000Z',
          },
          {
            id: 'journal-2',
            event_type: 'station.building.upgrade.finalize.v1',
            importance: 'important',
            description: 'Storage upgraded to level 3!',
            occurred_at: '2026-03-12T16:30:05.000Z',
          },
        ],
        next_cursor: null,
      }),
    } as Response)

    render(<JournalPage />)

    expect(await screen.findByRole('heading', { name: /^journal$/i })).toBeInTheDocument()
    expect(screen.getByText(/recovered station activity log/i)).toBeInTheDocument()
    expect(screen.getByText(/showing latest 20 entries/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/journal toolbar/i)).toBeInTheDocument()
    expect(screen.getAllByText(/^return$/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^upgrade$/i).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/mining rig returned with full cargo: metals x12, water x3!/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/storage upgraded to level 3!/i)).toBeInTheDocument()
    expect(screen.getAllByLabelText(/journal timestamp/i)).toHaveLength(2)
    expect(screen.getByLabelText(/journal events list/i)).toBeInTheDocument()
  })

  it('shows enriched empty state when no journal events exist', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ events: [], next_cursor: null }),
    } as Response)

    render(<JournalPage />)

    expect(await screen.findByText(/no archived events yet/i)).toBeInTheDocument()
    expect(
      screen.getByText(/your station has not recorded any completed transmissions/i),
    ).toBeInTheDocument()
  })

  it('shows retryable error state when journal fetch fails', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'journal-3',
              event_type: 'station.mining.rig.arrived.v1',
              importance: 'info',
              description: 'Mining rig arrived at destination',
              occurred_at: '2026-03-12T15:45:49.000Z',
            },
          ],
          next_cursor: null,
        }),
      } as Response)

    render(<JournalPage />)

    expect(await screen.findByText(/archive link unavailable/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /reload journal/i }))

    await waitFor(() =>
      expect(screen.getByText(/mining rig arrived at destination/i)).toBeInTheDocument(),
    )
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('applies filters and resets the archive to the filtered first page', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input))

      if (url.searchParams.get('date_range') === '7d') {
        return {
          ok: true,
          json: async () => ({
            events: [
              {
                id: 'journal-filtered',
                event_type: 'station.mining.rig.arrived.v1',
                importance: 'warning',
                description: 'Mining rig arrived on an occupied destination!',
                occurred_at: '2026-03-12T18:30:05.000Z',
              },
            ],
            next_cursor: null,
          }),
        } as Response
      }

      return {
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'journal-default',
              event_type: 'station.mining.rig.returned.v1',
              importance: 'important',
              description: 'Mining rig returned with Metals x12, Water x3!',
              occurred_at: '2026-03-12T17:01:05.000Z',
            },
          ],
          next_cursor: 'next-page-cursor',
        }),
      } as Response
    })

    render(<JournalPage />)

    expect(
      await screen.findByText(/mining rig returned with metals x12, water x3!/i),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^7d$/i }))

    await waitFor(() =>
      expect(
        screen.getByText(/mining rig arrived on an occupied destination!/i),
      ).toBeInTheDocument(),
    )
    expect(
      screen.queryByText(/mining rig returned with metals x12, water x3!/i),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/filtered archive: 7d/i)).toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes('date_range=7d'))).toBe(
      true,
    )
  })

  it('loads more older entries without replacing the existing archive', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'journal-1',
              event_type: 'station.mining.rig.returned.v1',
              importance: 'important',
              description: 'Mining rig returned with Metals x12, Water x3!',
              occurred_at: '2026-03-12T17:01:05.000Z',
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
              id: 'journal-2',
              event_type: 'station.building.upgrade.finalize.v1',
              importance: 'important',
              description: 'Storage upgraded to level 3!',
              occurred_at: '2026-03-12T16:30:05.000Z',
            },
          ],
          next_cursor: null,
        }),
      } as Response)

    render(<JournalPage />)

    expect(
      await screen.findByText(/mining rig returned with metals x12, water x3!/i),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /load more/i }))

    await waitFor(() =>
      expect(screen.getByText(/storage upgraded to level 3!/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/mining rig returned with metals x12, water x3!/i)).toBeInTheDocument()
    expect(screen.getByText(/end of recovered log/i)).toBeInTheDocument()
    expect(fetchSpy.mock.calls[1]?.[0]).toContain('cursor=cursor-page-2')
  })

  it('shows inline retry when loading more fails', async () => {
    vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'journal-1',
              event_type: 'station.mining.rig.arrived.v1',
              importance: 'info',
              description: 'Mining rig arrived at destination',
              occurred_at: '2026-03-12T15:45:49.000Z',
            },
          ],
          next_cursor: 'cursor-page-2',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'journal-2',
              event_type: 'station.mining.rig.returned.v1',
              importance: 'important',
              description: 'Mining rig returned after depleting the asteroid with Metals x4!',
              occurred_at: '2026-03-12T15:40:49.000Z',
            },
          ],
          next_cursor: null,
        }),
      } as Response)

    render(<JournalPage />)

    expect(await screen.findByText(/mining rig arrived at destination/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /load more/i }))

    expect(
      await screen.findByText(/the archive could not recover older transmissions\. try again\./i),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /retry load more/i }))

    await waitFor(() =>
      expect(
        screen.getByText(/mining rig returned after depleting the asteroid with metals x4!/i),
      ).toBeInTheDocument(),
    )
  })
})
