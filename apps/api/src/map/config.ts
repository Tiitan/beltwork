import { readFile } from 'node:fs/promises'
import { z } from 'zod'

const mapConfigSchema = z.object({
  world_bounds: z.object({
    min_x: z.number().int(),
    max_x: z.number().int(),
    min_y: z.number().int(),
    max_y: z.number().int(),
  }),
  spawn_constraints: z.object({
    min_station_to_asteroid_distance: z.number().nonnegative(),
    min_asteroid_separation: z.number().nonnegative(),
  }),
  station_spawn_rules: z.object({
    avoid_overlap_radius: z.number().nonnegative(),
  }),
  asteroid_spawn_rules: z.object({
    target_non_depleted_asteroids: z.number().int().positive().default(200),
  }),
})

export type LoadedMapConfig = {
  worldBounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
  spawnConstraints: {
    minStationToAsteroidDistance: number
    minAsteroidSeparation: number
  }
  stationSpawnRules: {
    avoidOverlapRadius: number
  }
  asteroidSpawnRules: {
    targetNonDepletedAsteroids: number
  }
}

export async function loadMapConfig(): Promise<LoadedMapConfig> {
  const configFileUrl = new URL('../../../../gameconfig/map.json', import.meta.url)
  const configRaw = await readFile(configFileUrl, 'utf8')
  const parsed = JSON.parse(configRaw) as unknown
  const config = mapConfigSchema.parse(parsed)

  return {
    worldBounds: {
      minX: config.world_bounds.min_x,
      maxX: config.world_bounds.max_x,
      minY: config.world_bounds.min_y,
      maxY: config.world_bounds.max_y,
    },
    spawnConstraints: {
      minStationToAsteroidDistance: config.spawn_constraints.min_station_to_asteroid_distance,
      minAsteroidSeparation: config.spawn_constraints.min_asteroid_separation,
    },
    stationSpawnRules: {
      avoidOverlapRadius: config.station_spawn_rules.avoid_overlap_radius,
    },
    asteroidSpawnRules: {
      targetNonDepletedAsteroids: config.asteroid_spawn_rules.target_non_depleted_asteroids,
    },
  }
}
