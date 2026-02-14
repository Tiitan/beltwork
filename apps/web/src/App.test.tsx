import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

describe('Login page', () => {
  it('renders the sign-in form', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows finite target cycles when infinite mode is disabled', () => {
    render(<App />)

    const infiniteToggle = screen.getByRole('checkbox', { name: /infinite production/i })
    expect(infiniteToggle).toBeChecked()

    fireEvent.click(infiniteToggle)
    expect(infiniteToggle).not.toBeChecked()
    expect(screen.getByLabelText(/target cycles/i)).toBeInTheDocument()
  })

  it('shows queue status fields', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /factory queue/i })).toBeInTheDocument()
    expect(screen.getByText(/status/i)).toBeInTheDocument()
    expect(screen.getByText(/progress/i)).toBeInTheDocument()
    expect(screen.getByText(/paused reason/i)).toBeInTheDocument()
  })
})
