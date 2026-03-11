import { describe, expect, it, vi } from 'vitest'
import type { MapElement } from '../../../types/app'
import { resolveRendererForElement } from '../panels/entityRenderers'
import {
  clampMapCameraOffset,
  drawBackgroundAndWorldBorder,
  findNearestEntityHit,
} from './mapCanvas'

describe('mapCanvas hit testing', () => {
  it('picks nearest hit regardless of entity order', () => {
    const entities: MapElement[] = [
      { type: 'asteroid', data: { id: 'a-1', x: 10, y: 10, isScanned: false } },
      { type: 'station', data: { id: 's-1', name: 'Base', x: 12, y: 10 } },
    ]

    const hit = findNearestEntityHit(11.6, 10, entities, 1, resolveRendererForElement)

    expect(hit).toEqual({ type: 'station', id: 's-1' })
  })
})

describe('mapCanvas camera and border', () => {
  it('clamps offsets within world bounds with edge margin', () => {
    const worldBounds = { minX: 0, maxX: 10000, minY: 0, maxY: 10000 }

    const clampedRight = clampMapCameraOffset(500, 500, 1, 1000, 800, worldBounds)
    expect(clampedRight).toEqual({ x: 32, y: 32 })

    const clampedLeft = clampMapCameraOffset(-9500, -9500, 1, 1000, 800, worldBounds)
    expect(clampedLeft).toEqual({ x: -9032, y: -9232 })
  })

  it('centers camera when world (plus margin) is smaller than viewport', () => {
    const worldBounds = { minX: 0, maxX: 100, minY: 0, maxY: 80 }
    const centered = clampMapCameraOffset(999, -999, 1, 500, 400, worldBounds)
    expect(centered).toEqual({ x: 200, y: 160 })
  })

  it('draws world border rectangle instead of axis lines', () => {
    const context = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D

    drawBackgroundAndWorldBorder(
      context,
      800,
      600,
      { scale: 1, offsetX: 10, offsetY: 20 },
      { minX: 0, maxX: 100, minY: 0, maxY: 50 },
    )

    expect((context as any).strokeRect).toHaveBeenCalledWith(10, 20, 100, 50)
  })
})
