import { describe, expect, it } from 'vitest'
import { isFarEnoughFromPoints } from '../map/placement.js'
import { buildAsteroidSpawnBatch, selectWeightedTemplate } from './generateAsteroids.js'

function sequenceRandom(values: number[]): () => number {
  let index = 0
  return () => {
    const next = values[index]
    index += 1
    return next ?? 0.5
  }
}

describe('generateAsteroids script logic', () => {
  it('selects templates using spawn weight ranges', () => {
    const templates = [
      { id: 'common', spawn_weight: 40, depletion_units: 1000 },
      { id: 'carbon', spawn_weight: 25, depletion_units: 900 },
      { id: 'metal', spawn_weight: 20, depletion_units: 1100 },
      { id: 'conductor', spawn_weight: 10, depletion_units: 950 },
      { id: 'rare', spawn_weight: 5, depletion_units: 1300 },
    ]

    expect(selectWeightedTemplate(templates, () => 0).id).toBe('common')
    expect(selectWeightedTemplate(templates, () => 0.401).id).toBe('carbon')
    expect(selectWeightedTemplate(templates, () => 0.999).id).toBe('rare')
  })

  it('validates distance checks for points', () => {
    const points = [{ x: 100, y: 100 }]

    expect(isFarEnoughFromPoints(100, 100, points, 1)).toBe(false)
    expect(isFarEnoughFromPoints(103, 104, points, 5)).toBe(true)
    expect(isFarEnoughFromPoints(103, 104, points, 6)).toBe(false)
  })

  it('retries placement until all constraints are satisfied', () => {
    const templates = [{ id: 'common', spawn_weight: 1, depletion_units: 1800 }]
    const random01 = sequenceRandom([
      0.1, // template pick
      0.46, // x=5 (invalid near station)
      0.46, // y=5 (invalid near station)
      0.9, // x=9 (valid retry)
      0.9, // y=9 (valid retry)
    ])

    const rows = buildAsteroidSpawnBatch({
      templates,
      worldBounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
      minStationDistance: 3,
      minAsteroidSeparation: 2,
      stationPoints: [{ x: 5, y: 5 }],
      existingAsteroidPoints: [{ x: 0, y: 0 }],
      countToGenerate: 1,
      random01,
      createSeed: () => 'seed-1',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      templateId: 'common',
      x: 9,
      y: 9,
      remainingUnits: 1800,
      seed: 'seed-1',
      isDepleted: false,
    })
  })

  it('throws when no valid position can be found', () => {
    const templates = [{ id: 'common', spawn_weight: 1, depletion_units: 1800 }]

    expect(() =>
      buildAsteroidSpawnBatch({
        templates,
        worldBounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
        minStationDistance: 1,
        minAsteroidSeparation: 0,
        stationPoints: [{ x: 0, y: 0 }],
        existingAsteroidPoints: [],
        countToGenerate: 1,
        random01: () => 0,
        createSeed: () => 'seed-1',
      }),
    ).toThrow(/Unable to place asteroid/)
  })
})
