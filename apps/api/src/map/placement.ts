export type Point = { x: number; y: number }

export type WorldBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type DistanceRule = {
  points: Point[]
  minDistance: number
}

export type PlacementOptions = {
  worldBounds: WorldBounds
  maxAttempts: number
  rules: DistanceRule[]
  random01?: () => number
}

export function randomIntInRange(
  min: number,
  max: number,
  random01: () => number = Math.random,
): number {
  return Math.floor(random01() * (max - min + 1)) + min
}

export function isFarEnoughFromPoints(
  x: number,
  y: number,
  points: Point[],
  minDistance: number,
): boolean {
  if (minDistance <= 0 || points.length === 0) {
    return true
  }

  const minDistanceSq = minDistance * minDistance
  for (const point of points) {
    const dx = x - point.x
    const dy = y - point.y
    if (dx * dx + dy * dy < minDistanceSq) {
      return false
    }
  }

  return true
}

export function findConstrainedPoint({
  worldBounds,
  maxAttempts,
  rules,
  random01 = Math.random,
}: PlacementOptions): Point | null {
  for (let attempts = 0; attempts < maxAttempts; attempts += 1) {
    const x = randomIntInRange(worldBounds.minX, worldBounds.maxX, random01)
    const y = randomIntInRange(worldBounds.minY, worldBounds.maxY, random01)

    const isValid = rules.every((rule) =>
      isFarEnoughFromPoints(x, y, rule.points, rule.minDistance),
    )

    if (isValid) {
      return { x, y }
    }
  }

  return null
}

export function findPointWithFallback(options: PlacementOptions): {
  point: Point
  usedFallback: boolean
} {
  const constrainedPoint = findConstrainedPoint(options)
  if (constrainedPoint) {
    return { point: constrainedPoint, usedFallback: false }
  }

  return {
    point: {
      x: randomIntInRange(options.worldBounds.minX, options.worldBounds.maxX, options.random01),
      y: randomIntInRange(options.worldBounds.minY, options.worldBounds.maxY, options.random01),
    },
    usedFallback: true,
  }
}
