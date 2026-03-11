import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from './App'

/**
 * Covers login/station routing and session flow behavior.
 */
describe('Login page', () => {
  /**
   * Renders the app at a specific browser path for route assertions.
   *
   * @param path Initial browser pathname to test.
   * @returns Testing Library render result.
   */
  function renderAppAt(path: string) {
    window.history.replaceState(null, '', path)
    return render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
  }

  let sessionExists = false

  beforeEach(() => {
    sessionExists = false

    vi.spyOn(window, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)

      if (url.endsWith('/v1/session/bootstrap')) {
        if (sessionExists) {
          return {
            ok: true,
            json: async () => ({
              authenticated: true,
              profile: {
                id: 'p-1',
                auth_type: 'guest',
                display_name: 'Calm Prospector 0421',
                email: '',
                google_linked: false,
                google_linked_email: '',
              },
            }),
          } as Response
        }

        return {
          ok: true,
          json: async () => ({ authenticated: false }),
        } as Response
      }

      if (url.endsWith('/v1/session/start-now')) {
        sessionExists = true
        return {
          ok: true,
          json: async () => ({
            authenticated: true,
            profile: {
              id: 'p-guest',
              auth_type: 'guest',
              display_name: 'Calm Prospector 0421',
              email: '',
              google_linked: false,
              google_linked_email: '',
            },
          }),
        } as Response
      }

      if (url.endsWith('/v1/session/logout')) {
        sessionExists = false
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response
      }

      if (url.endsWith('/v1/auth/login') && init?.method === 'POST') {
        sessionExists = true
        return {
          ok: true,
          json: async () => ({
            authenticated: true,
            profile: {
              id: 'p-local',
              auth_type: 'local',
              display_name: 'Local Pilot',
              email: 'pilot@example.com',
              google_linked: false,
              google_linked_email: '',
            },
          }),
        } as Response
      }

      if (url.endsWith('/v1/station') && init?.method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            id: 'st-1',
            x: 140,
            y: -25,
            inventory: [
              { resource_key: 'water', amount: 100 },
              { resource_key: 'metals', amount: 50 },
              { resource_key: 'conductors', amount: 25 },
              { resource_key: 'carbon_materials', amount: 15 },
            ],
            buildings: [],
            buildable_buildings: [
              { id: 'fusion_reactor', name: 'Fusion Reactor' },
              { id: 'life_support', name: 'Life Support' },
            ],
          }),
        } as Response
      }

      if (url.endsWith('/v1/map') && init?.method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            world_bounds: { min_x: 0, max_x: 10000, min_y: 0, max_y: 10000 },
            stations: [{ id: 'st-1', name: 'Calm Prospector 0421', x: 140, y: -25 }],
            asteroids: [],
          }),
        } as Response
      }

      if (url.endsWith('/v1/station/buildings') && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            id: 'st-1',
            x: 140,
            y: -25,
            inventory: [
              { resource_key: 'water', amount: 100 },
              { resource_key: 'metals', amount: 50 },
              { resource_key: 'conductors', amount: 25 },
              { resource_key: 'carbon_materials', amount: 15 },
            ],
            buildings: [
              {
                id: 'building-1',
                building_type: 'fusion_reactor',
                level: 1,
                status: 'idle',
                upgrade_finish_at: null,
                slot_index: 1,
              },
            ],
            buildable_buildings: [{ id: 'life_support', name: 'Life Support' }],
          }),
        } as Response
      }

      return {
        ok: false,
        json: async () => ({}),
      } as Response
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects root to login when no session exists', async () => {
    renderAppAt('/')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start now/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/google sign in/i)).toBeInTheDocument()
  })

  it('redirects root to station when a session exists', async () => {
    sessionExists = true
    renderAppAt('/')

    await waitFor(() => expect(window.location.pathname).toBe('/station'))
    expect(screen.getByRole('heading', { level: 1, name: /^station$/i })).toBeInTheDocument()
  })

  it('redirects login to station when a session exists', async () => {
    sessionExists = true
    renderAppAt('/login')

    await waitFor(() => expect(window.location.pathname).toBe('/station'))
    expect(screen.getByRole('heading', { level: 1, name: /^station$/i })).toBeInTheDocument()
  })

  it('opens station draft after start now', async () => {
    renderAppAt('/login')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    fireEvent.click(screen.getByRole('button', { name: /start now/i }))

    await waitFor(() => expect(window.location.pathname).toBe('/station'))
    expect(screen.getByRole('heading', { level: 1, name: /^station$/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/station page canvas/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^station$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /map/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /account settings/i })).toBeInTheDocument()
  })

  it('shows station not found for removed station sections', async () => {
    sessionExists = true
    renderAppAt('/station/buildings')

    await waitFor(() => expect(window.location.pathname).toBe('/station/buildings'))
    expect(screen.getByRole('heading', { name: /station page not found/i })).toBeInTheDocument()
  })

  it('redirects station to login without session', async () => {
    renderAppAt('/station')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()
  })

  it('renders map at /map when authenticated', async () => {
    sessionExists = true
    renderAppAt('/map')

    await waitFor(() => expect(window.location.pathname).toBe('/map'))
    expect(screen.getByLabelText(/map page canvas/i)).toBeInTheDocument()
  })

  it('renders account at /account when authenticated', async () => {
    sessionExists = true
    renderAppAt('/account')

    await waitFor(() => expect(window.location.pathname).toBe('/account'))
    expect(screen.getByRole('heading', { name: /account settings/i })).toBeInTheDocument()
  })

  it('redirects map to login without session', async () => {
    renderAppAt('/map')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()
  })

  it('redirects account to login without session', async () => {
    renderAppAt('/account')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()
  })

  it('warns and disconnects guest on logout', async () => {
    sessionExists = true
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderAppAt('/station')

    await waitFor(() => expect(window.location.pathname).toBe('/station'))
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument(),
    )

    confirmSpy.mockRestore()
  })
})
