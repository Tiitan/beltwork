import { describe, expect, it } from 'vitest'
import {
  findConstrainedPoint,
  findPointWithFallback,
  isFarEnoughFromPoints,
  randomIntInRange,
} from './placement.js'

function sequenceRandom(values: number[]): () => number {
  let index = 0
  return () => {
    const next = values[index]
    index += 1
    return next ?? 0.5
  }
}

describe('map placement', () => {
  it('randomIntInRange returns inclusive values in bounds', () => {
    expect(randomIntInRange(5, 10, () => 0)).toBe(5)
    expect(randomIntInRange(5, 10, () => 0.999999)).toBe(10)
  })

  it('isFarEnoughFromPoints validates distance thresholds', () => {
    const points = [{ x: 100, y: 100 }]
    expect(isFarEnoughFromPoints(100, 100, points, 1)).toBe(false)
    expect(isFarEnoughFromPoints(103, 104, points, 5)).toBe(true)
    expect(isFarEnoughFromPoints(103, 104, points, 6)).toBe(false)
  })

  it('findConstrainedPoint returns null when no point satisfies constraints', () => {
    const point = findConstrainedPoint({
      worldBounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      maxAttempts: 3,
      rules: [{ points: [{ x: 0, y: 0 }], minDistance: 1 }],
      random01: () => 0,
    })

    expect(point).toBeNull()
  })

  it('findConstrainedPoint retries and eventually returns a valid point', () => {
    const random01 = sequenceRandom([
      0.46, // x=5
      0.46, // y=5 invalid against point (5,5)
      0.9, // x=9
      0.9, // y=9 valid
    ])

    const point = findConstrainedPoint({
      worldBounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
      maxAttempts: 10,
      rules: [{ points: [{ x: 5, y: 5 }], minDistance: 3 }],
      random01,
    })

    expect(point).toEqual({ x: 9, y: 9 })
  })

  it('findPointWithFallback returns fallback point when constrained placement fails', () => {
    const random01 = sequenceRandom([
      0, // constrained attempt x=0
      0, // constrained attempt y=0
      0.999999, // fallback x=10
      0.999999, // fallback y=10
    ])

    const result = findPointWithFallback({
      worldBounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
      maxAttempts: 1,
      rules: [{ points: [{ x: 0, y: 0 }], minDistance: 1 }],
      random01,
    })

    expect(result).toEqual({
      point: { x: 10, y: 10 },
      usedFallback: true,
    })
  })
})
