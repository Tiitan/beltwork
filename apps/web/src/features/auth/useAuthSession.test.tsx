import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAuthSession } from './useAuthSession'

function AuthConsumerWithoutProvider() {
  useAuthSession()
  return null
}

describe('useAuthSession', () => {
  it('throws when used outside AuthSessionProvider', () => {
    expect(() => render(<AuthConsumerWithoutProvider />)).toThrow(
      /useAuthSession must be used within AuthSessionProvider/i,
    )
  })
})
