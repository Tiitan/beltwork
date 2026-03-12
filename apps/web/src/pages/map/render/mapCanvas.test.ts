import { describe, expect, it, vi } from 'vitest'
import type { MapElement } from '../../../types/app'
import { resolveRendererForElement } from '../panels/entityRenderers'
import {
  clampMapCameraOffset,
  drawBackgroundAndWorldBorder,
  drawMiningOperationOverlays,
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

  it('draws mining overlays for flying and mining operations', () => {
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D

    drawMiningOperationOverlays(
      context,
      { scale: 1, offsetX: 0, offsetY: 0 },
      {
        playerStation: { id: 'station-1', x: 10, y: 10 },
        asteroidById: new Map([
          ['ast-1', { x: 20, y: 20 }],
          ['ast-2', { x: 30, y: 30 }],
        ]),
        nowMs: Date.parse('2026-03-11T18:00:05.000Z'),
        operations: [
          {
            id: 'op-1',
            asteroidId: 'ast-1',
            status: 'flying_to_destination',
            phaseStartedAt: '2026-03-11T18:00:00.000Z',
            phaseFinishAt: '2026-03-11T18:00:10.000Z',
            returnOriginProgress: null,
            quantity: 0,
            quantityTarget: 500,
            cargoCapacity: 500,
            estimatedAsteroidRemainingUnits: 1000,
            asteroidRemainingUnitsAtMiningStart: null,
          },
          {
            id: 'op-2',
            asteroidId: 'ast-2',
            status: 'mining',
            phaseStartedAt: '2026-03-11T18:00:00.000Z',
            phaseFinishAt: '2026-03-11T18:00:10.000Z',
            returnOriginProgress: null,
            quantity: 0,
            quantityTarget: 500,
            cargoCapacity: 500,
            estimatedAsteroidRemainingUnits: 900,
            asteroidRemainingUnitsAtMiningStart: 900,
          },
        ],
      },
    )

    expect((context as any).setLineDash).toHaveBeenCalled()
    expect((context as any).lineTo).toHaveBeenCalled()
    expect((context as any).arc).toHaveBeenCalled()
  })

  it('renders returning rig from return origin progress instead of asteroid', () => {
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D

    drawMiningOperationOverlays(
      context,
      { scale: 1, offsetX: 0, offsetY: 0 },
      {
        playerStation: { id: 'station-1', x: 0, y: 0 },
        asteroidById: new Map([['ast-1', { x: 100, y: 0 }]]),
        nowMs: Date.parse('2026-03-11T18:00:05.000Z'),
        operations: [
          {
            id: 'op-1',
            asteroidId: 'ast-1',
            status: 'returning',
            phaseStartedAt: '2026-03-11T18:00:00.000Z',
            phaseFinishAt: '2026-03-11T18:00:10.000Z',
            returnOriginProgress: 0.25,
            quantity: 0,
            quantityTarget: 500,
            cargoCapacity: 500,
            estimatedAsteroidRemainingUnits: 1000,
            asteroidRemainingUnitsAtMiningStart: null,
          },
        ],
      },
    )

    const arcCalls = (context as any).arc.mock.calls as Array<
      [number, number, number, number, number]
    >
    expect(arcCalls).toHaveLength(1)
    expect(arcCalls[0]?.[0]).toBeCloseTo(12.5, 5)
    expect(arcCalls[0]?.[1]).toBeCloseTo(0, 5)
  })

  it('falls back to asteroid-origin return path when return origin progress is null', () => {
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D

    drawMiningOperationOverlays(
      context,
      { scale: 1, offsetX: 0, offsetY: 0 },
      {
        playerStation: { id: 'station-1', x: 0, y: 0 },
        asteroidById: new Map([['ast-1', { x: 100, y: 0 }]]),
        nowMs: Date.parse('2026-03-11T18:00:05.000Z'),
        operations: [
          {
            id: 'op-1',
            asteroidId: 'ast-1',
            status: 'returning',
            phaseStartedAt: '2026-03-11T18:00:00.000Z',
            phaseFinishAt: '2026-03-11T18:00:10.000Z',
            returnOriginProgress: null,
            quantity: 0,
            quantityTarget: 500,
            cargoCapacity: 500,
            estimatedAsteroidRemainingUnits: 1000,
            asteroidRemainingUnitsAtMiningStart: null,
          },
        ],
      },
    )

    const arcCalls = (context as any).arc.mock.calls as Array<
      [number, number, number, number, number]
    >
    expect(arcCalls).toHaveLength(1)
    expect(arcCalls[0]?.[0]).toBeCloseTo(50, 5)
    expect(arcCalls[0]?.[1]).toBeCloseTo(0, 5)
  })
})
