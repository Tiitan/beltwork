import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { entityRenderers } from './entityRenderers'

describe('entityRenderers', () => {
  it('returns station label and coordinates', () => {
    const station = { id: 'station-1', name: 'Commander Base', x: 140, y: -25 }

    expect(entityRenderers.station.getLabel(station)).toBe('Commander Base')
    expect(entityRenderers.station.getCoordinates(station)).toEqual({ x: 140, y: -25 })
  })

  it('returns unknown label for unscanned asteroid via renderer', () => {
    const asteroid = { id: 'ast-1', x: 30, y: 40, isScanned: false as const }

    expect(entityRenderers.asteroid.getLabel(asteroid)).toBe('Unknown Asteroid')
    expect(entityRenderers.asteroid.getCoordinates(asteroid)).toEqual({ x: 30, y: 40 })
  })

  it('renders tooltip markup for scanned asteroid', () => {
    const result = render(
      <div>
        {entityRenderers.asteroid.renderTooltip({
          id: 'ast-2',
          x: 1,
          y: 2,
          isScanned: true,
          name: 'Icy Rare Body',
        })}
      </div>,
    )

    expect(result.getByText('Icy Rare Body')).toBeInTheDocument()
    expect(result.getByText('X: 1 | Y: 2')).toBeInTheDocument()
  })

  it('provides draw and hit configuration for each entity renderer', () => {
    const station = entityRenderers.station
    const asteroid = entityRenderers.asteroid

    expect(station.getIconPath({ id: 's-1', name: 'Base', x: 0, y: 0 })).toContain('stations')
    expect(station.getIconSize({ id: 's-1', name: 'Base', x: 0, y: 0 })).toBeGreaterThan(0)
    expect(
      station.getSelectionStyle({ id: 's-1', name: 'Base', x: 0, y: 0 }).radiusScale,
    ).toBeGreaterThan(0)
    expect(station.getHitRadius({ id: 's-1', name: 'Base', x: 0, y: 0 }, 1)).toBeGreaterThan(0)

    expect(asteroid.getIconPath({ id: 'a-1', x: 0, y: 0, isScanned: false })).toContain('asteroids')
    expect(asteroid.getIconSize({ id: 'a-1', x: 0, y: 0, isScanned: false })).toBeGreaterThan(0)
    expect(
      asteroid.getSelectionStyle({ id: 'a-1', x: 0, y: 0, isScanned: false }).radiusScale,
    ).toBeGreaterThan(0)
    expect(asteroid.getHitRadius({ id: 'a-1', x: 0, y: 0, isScanned: false }, 1)).toBeGreaterThan(0)
  })
})
