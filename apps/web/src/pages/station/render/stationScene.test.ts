import { describe, expect, it, vi } from 'vitest'
import { getBuildingIconPath } from '../../../features/station/iconPaths'
import type { StationSlotEntity } from '../panels/types'
import { drawStationScene } from './stationScene'

function createImage(width = 64, height = 64) {
  return {
    complete: true,
    naturalWidth: width,
    naturalHeight: height,
  } as HTMLImageElement
}

function createContextMock() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
    filter: '',
    shadowColor: '',
    shadowBlur: 0,
    fillStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D
}

function createBuildingEntity(status: 'idle' | 'upgrading'): StationSlotEntity {
  return {
    kind: 'building_slot',
    slot: {
      slotIndex: 1,
      x: 300,
      y: 250,
      width: 140,
      height: 120,
    },
    building: {
      id: 'building-1',
      type: 'storage',
      level: 1,
      status,
      upgradeFinishAt: status === 'upgrading' ? new Date(Date.now() + 30_000).toISOString() : null,
      slotIndex: 1,
    },
  }
}

describe('stationScene upgrade progress rendering', () => {
  it('does not draw progress bar for idle buildings', () => {
    const context = createContextMock()
    const imageCache = new Map<string, HTMLImageElement>([
      [getBuildingIconPath('storage'), createImage()],
    ])

    drawStationScene(
      context,
      1024,
      768,
      { scale: 1, offsetX: 0, offsetY: 0 },
      createImage(1024, 768),
      [createBuildingEntity('idle')],
      null,
      null,
      imageCache,
      () => {},
      Date.now(),
    )

    expect(context.fillRect).toHaveBeenCalledTimes(1)
  })

  it('draws progress bar for upgrading buildings', () => {
    const context = createContextMock()
    const imageCache = new Map<string, HTMLImageElement>([
      [getBuildingIconPath('storage'), createImage()],
    ])

    drawStationScene(
      context,
      1024,
      768,
      { scale: 1, offsetX: 0, offsetY: 0 },
      createImage(1024, 768),
      [createBuildingEntity('upgrading')],
      null,
      null,
      imageCache,
      () => {},
      Date.now(),
    )

    expect(context.fillRect).toHaveBeenCalledTimes(3)
  })
})
