import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'

describe('Login page', () => {
  it('redirects root to login when no session exists', () => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')

    render(<App />)

    expect(window.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start now/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('redirects root to station when a session exists', () => {
    window.localStorage.setItem('beltwork_session_type', 'guest')
    window.history.replaceState(null, '', '/')

    render(<App />)

    expect(window.location.pathname).toBe('/station')
    expect(screen.getByRole('heading', { name: /station/i })).toBeInTheDocument()
  })

  it('redirects login to station when a session exists', () => {
    window.localStorage.setItem('beltwork_session_type', 'guest')
    window.history.replaceState(null, '', '/login')

    render(<App />)

    expect(window.location.pathname).toBe('/station')
    expect(screen.getByRole('heading', { name: /station/i })).toBeInTheDocument()
  })

  it('opens station draft after start now', () => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/login')

    render(<App />)

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
    window.history.replaceState(null, '', '/station')

    render(<App />)

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
    window.history.replaceState(null, '', '/station')

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(window.localStorage.getItem('beltwork_session_type')).toBeNull()
    expect(window.localStorage.getItem('beltwork_profile')).toBeNull()
    expect(window.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()

    confirmSpy.mockRestore()
  })
})
