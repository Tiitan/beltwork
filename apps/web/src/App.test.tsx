import { render, screen } from '@testing-library/react'
import App from './App'

describe('Login page', () => {
  it('renders the sign-in form', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })
})
