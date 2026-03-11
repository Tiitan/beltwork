/**
 * Registers DOM-specific Vitest matchers for web tests.
 */
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
}

if (typeof HTMLCanvasElement !== 'undefined') {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    const mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
    }

    return mockContext as unknown as CanvasRenderingContext2D
  })
}
