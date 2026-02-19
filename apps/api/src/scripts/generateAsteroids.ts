import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { loadMapConfig } from '../map/config.js'
import { findConstrainedPoint, type Point, type WorldBounds } from '../map/placement.js'
import { asteroid, stations } from '../db/schema.js'

const MAX_POSITION_ATTEMPTS_PER_ASTEROID = 5_000

const asteroidConfigSchema = z.object({
  asteroid_templates: z
    .array(
      z.object({
        id: z.string().min(1),
        spawn_weight: z.number().positive(),
        depletion_units: z.number().int().positive(),
      }),
    )
    .min(1),
})

type AsteroidTemplate = {
  id: string
  spawn_weight: number
  depletion_units: number
}
type SpawnInsertRow = {
  templateId: string
  x: number
  y: number
  remainingUnits: number
  seed: string
  isDepleted: false
}

type SpawnGenerationInput = {
  templates: AsteroidTemplate[]
  worldBounds: WorldBounds
  minStationDistance: number
  minAsteroidSeparation: number
  stationPoints: Point[]
  existingAsteroidPoints: Point[]
  countToGenerate: number
  random01?: () => number
  createSeed?: () => string
}

async function loadJsonFile<T>(fileUrl: URL, schema: z.ZodSchema<T>): Promise<T> {
  const raw = await readFile(fileUrl, 'utf8')
  const parsed = JSON.parse(raw) as unknown
  return schema.parse(parsed)
}

export function selectWeightedTemplate(
  templates: AsteroidTemplate[],
  random01: () => number = Math.random,
): AsteroidTemplate {
  const totalWeight = templates.reduce((sum, template) => sum + template.spawn_weight, 0)
  const pick = random01() * totalWeight
  let cumulative = 0
  for (const template of templates) {
    cumulative += template.spawn_weight
    if (pick <= cumulative) {
      return template
    }
  }

  return templates[templates.length - 1]
}

export function buildAsteroidSpawnBatch({
  templates,
  worldBounds,
  minStationDistance,
  minAsteroidSeparation,
  stationPoints,
  existingAsteroidPoints,
  countToGenerate,
  random01 = Math.random,
  createSeed = randomUUID,
}: SpawnGenerationInput): SpawnInsertRow[] {
  const asteroidPoints: Point[] = existingAsteroidPoints.map((point) => ({ ...point }))
  const toInsert: SpawnInsertRow[] = []

  for (let i = 0; i < countToGenerate; i += 1) {
    const selectedTemplate = selectWeightedTemplate(templates, random01)
    const placedPoint = findConstrainedPoint({
      worldBounds,
      maxAttempts: MAX_POSITION_ATTEMPTS_PER_ASTEROID,
      rules: [
        { points: stationPoints, minDistance: minStationDistance },
        { points: asteroidPoints, minDistance: minAsteroidSeparation },
      ],
      random01,
    })

    if (!placedPoint) {
      throw new Error(
        `Unable to place asteroid ${i + 1}/${countToGenerate} with constraints after ${MAX_POSITION_ATTEMPTS_PER_ASTEROID} attempts.`,
      )
    }

    asteroidPoints.push(placedPoint)

    toInsert.push({
      templateId: selectedTemplate.id,
      x: placedPoint.x,
      y: placedPoint.y,
      remainingUnits: selectedTemplate.depletion_units,
      seed: createSeed(),
      isDepleted: false,
    })
  }

  return toInsert
}

export async function main() {
  const { db, pool } = await import('../db/client.js')
  try {
    const asteroidConfigFileUrl = new URL('../../../../gameconfig/asteroids.json', import.meta.url)

    const asteroidConfig = await loadJsonFile(asteroidConfigFileUrl, asteroidConfigSchema)
    const mapConfig = await loadMapConfig()
    const targetNonDepletedAsteroids = mapConfig.asteroidSpawnRules.targetNonDepletedAsteroids

    const [{ count: nonDepletedCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(asteroid)
      .where(eq(asteroid.isDepleted, false))

    const currentNonDepleted = nonDepletedCount ?? 0
    const missingCount = Math.max(targetNonDepletedAsteroids - currentNonDepleted, 0)

    if (missingCount === 0) {
      console.log(
        `No generation needed. Non-depleted asteroids already at ${currentNonDepleted}/${targetNonDepletedAsteroids}.`,
      )
      return
    }

    const existingAsteroids = await db.select({ x: asteroid.x, y: asteroid.y }).from(asteroid)

    const stationPoints = await db.select({ x: stations.x, y: stations.y }).from(stations)

    const asteroidPoints: Point[] = existingAsteroids.map((row) => ({ x: row.x, y: row.y }))

    const minStationDistance = mapConfig.spawnConstraints.minStationToAsteroidDistance
    const minAsteroidSeparation = mapConfig.spawnConstraints.minAsteroidSeparation
    const toInsert = buildAsteroidSpawnBatch({
      templates: asteroidConfig.asteroid_templates,
      worldBounds: mapConfig.worldBounds,
      minStationDistance,
      minAsteroidSeparation,
      stationPoints,
      existingAsteroidPoints: asteroidPoints,
      countToGenerate: missingCount,
    })

    await db.insert(asteroid).values(toInsert)

    const [finalCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(asteroid)
      .where(eq(asteroid.isDepleted, false))

    const finalCount = finalCountRow?.count ?? currentNonDepleted + toInsert.length

    console.log(
      `Generated ${toInsert.length} asteroids. Non-depleted total: ${finalCount}/${targetNonDepletedAsteroids}.`,
    )
  } finally {
    await pool.end()
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (isDirectExecution) {
  main().catch((error) => {
    console.error('Asteroid generation failed:', error)
    process.exitCode = 1
  })
}
