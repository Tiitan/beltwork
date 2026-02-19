import { asc, eq } from 'drizzle-orm'
import { asteroid, stationInventory, stations } from '../db/schema.js'
import { loadMapConfig } from '../map/config.js'
import { findPointWithFallback } from '../map/placement.js'
import { startupResources } from '../station/newStationConfig.js'
import type { AppServices, StationSnapshotResponse } from '../types/api.js'

const STATION_SPAWN_MAX_ATTEMPTS = 5_000

export async function createStationForPlayer(
  services: AppServices,
  playerId: string,
): Promise<string> {
  const mapConfig = await loadMapConfig()

  const existingStationPoints = await services.db
    .select({
      x: stations.x,
      y: stations.y,
    })
    .from(stations)

  const asteroidPoints = await services.db
    .select({
      x: asteroid.x,
      y: asteroid.y,
    })
    .from(asteroid)

  const { point: stationPoint, usedFallback } = findPointWithFallback({
    worldBounds: mapConfig.worldBounds,
    maxAttempts: STATION_SPAWN_MAX_ATTEMPTS,
    rules: [
      {
        points: existingStationPoints,
        minDistance: mapConfig.stationSpawnRules.avoidOverlapRadius,
      },
      {
        points: asteroidPoints,
        minDistance: mapConfig.spawnConstraints.minStationToAsteroidDistance,
      },
    ],
  })

  const [insertedStation] = await services.db
    .insert(stations)
    .values({
      playerId,
      x: stationPoint.x,
      y: stationPoint.y,
    })
    .onConflictDoNothing({
      target: stations.playerId,
    })
    .returning({
      id: stations.id,
    })

  if (!insertedStation) {
    const [existingStation] = await services.db
      .select({
        id: stations.id,
      })
      .from(stations)
      .where(eq(stations.playerId, playerId))
      .limit(1)

    if (!existingStation) {
      throw new Error('failed_to_create_station')
    }

    return existingStation.id
  }

  if (usedFallback) {
    console.warn(
      `station_spawn_fallback playerId=${playerId} maxAttempts=${STATION_SPAWN_MAX_ATTEMPTS} x=${stationPoint.x} y=${stationPoint.y}`,
    )
  }

  if (startupResources.length > 0) {
    await services.db.insert(stationInventory).values(
      startupResources.map((resource) => ({
        stationId: insertedStation.id,
        resourceKey: resource.resource_key,
        amount: String(resource.amount),
      })),
    )
  }

  return insertedStation.id
}

export async function getStationSnapshotForPlayer(
  services: AppServices,
  playerId: string,
): Promise<StationSnapshotResponse | null> {
  const [stationRow] = await services.db
    .select({
      id: stations.id,
      x: stations.x,
      y: stations.y,
    })
    .from(stations)
    .where(eq(stations.playerId, playerId))
    .limit(1)

  if (!stationRow) {
    return null
  }

  const inventoryRows = await services.db
    .select({
      resource_key: stationInventory.resourceKey,
      amount: stationInventory.amount,
    })
    .from(stationInventory)
    .where(eq(stationInventory.stationId, stationRow.id))
    .orderBy(asc(stationInventory.resourceKey))

  return {
    station: stationRow,
    inventory: inventoryRows.map((row) => ({
      resource_key: row.resource_key,
      amount: Number(row.amount),
    })),
  }
}
