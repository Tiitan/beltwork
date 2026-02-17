import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useStation } from './useStation'

function StationConsumerWithoutProvider() {
  useStation()
  return null
}

describe('useStation', () => {
  it('throws when used outside StationProvider', () => {
    expect(() => render(<StationConsumerWithoutProvider />)).toThrow(
      /useStation must be used within StationProvider/i,
    )
  })
})
