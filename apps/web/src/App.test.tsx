import { fireEvent, render, screen } from '@testing-library/react'
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

  it('redirects root to login when no session exists', () => {
    window.localStorage.clear()
    renderAppAt('/')

    expect(window.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start now/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('redirects root to station when a session exists', () => {
    window.localStorage.setItem('beltwork_session_type', 'guest')
    renderAppAt('/')

    expect(window.location.pathname).toBe('/station')
    expect(screen.getByRole('heading', { name: /station/i })).toBeInTheDocument()
  })

  it('redirects login to station when a session exists', () => {
    window.localStorage.setItem('beltwork_session_type', 'guest')
    renderAppAt('/login')

    expect(window.location.pathname).toBe('/station')
    expect(screen.getByRole('heading', { name: /station/i })).toBeInTheDocument()
  })

  it('opens station draft after start now', () => {
    window.localStorage.clear()
    renderAppAt('/login')

    fireEvent.click(screen.getByRole('button', { name: /start now/i }))

    expect(window.location.pathname).toBe('/station')
    expect(window.localStorage.getItem('beltwork_session_type')).toBe('guest')
    expect(screen.getByRole('heading', { name: /station/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /summary/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /inventory/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /buildings/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /mining/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /factories/i })).toBeInTheDocument()
  })

  it('redirects station to login without session', () => {
    window.localStorage.clear()
    renderAppAt('/station')

    expect(window.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()
  })

  it('warns and deletes guest profile on disconnect', () => {
    window.localStorage.setItem('beltwork_session_type', 'guest')
    window.localStorage.setItem(
      'beltwork_profile',
      JSON.stringify({
        authType: 'guest',
        displayName: 'Calm Prospector 0421',
        email: '',
        password: '',
      }),
    )
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderAppAt('/station')

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(window.localStorage.getItem('beltwork_session_type')).toBeNull()
    expect(window.localStorage.getItem('beltwork_profile')).toBeNull()
    expect(window.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()

    confirmSpy.mockRestore()
  })
})
