import { describe, expect, it } from 'vitest'
import type { MapElement } from '../../../../types/app'
import { resolveRendererForElement } from '../panels/entityRenderers'
import { findNearestEntityHit } from './mapCanvas'

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
