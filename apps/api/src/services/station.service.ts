import { and, asc, eq, sql } from 'drizzle-orm'
import {
  asteroid,
  domainEvents,
  stationBuildings,
  stationInventory,
  stations,
} from '../db/schema.js'
import { loadMapConfig } from '../map/config.js'
import { findPointWithFallback } from '../map/placement.js'
import { startupResources } from '../station/newStationConfig.js'
import type { AppServices, StationSnapshotResponse } from '../types/api.js'

const STATION_SPAWN_MAX_ATTEMPTS = 5_000
const STATION_SLOT_COUNT = 10
export const BUILDING_UPGRADE_DURATION_MS = 60_000
export const STATION_BUILDING_UPGRADE_FINALIZE_EVENT_TYPE = 'station.building.upgrade.finalize.v1'

const temporaryBuildableBuildings = [
  { id: 'fusion_reactor', name: 'Fusion Reactor' },
  { id: 'life_support', name: 'Life Support' },
  { id: 'radiators', name: 'Radiators' },
  { id: 'mining_docks', name: 'Mining Docks' },
  { id: 'scanner_survey', name: 'Scanner and Survey' },
  { id: 'refinery', name: 'Refinery' },
  { id: 'assembler', name: 'Assembler' },
  { id: 'storage', name: 'Storage' },
] as const

type TemporaryBuildableBuildingId = (typeof temporaryBuildableBuildings)[number]['id']

export class StationBuildError extends Error {
  code:
    | 'station_not_found'
    | 'invalid_slot_index'
    | 'slot_occupied'
    | 'unsupported_building_type'
    | 'building_type_already_exists'
    | 'building_not_found'
    | 'building_already_upgrading'

  constructor(code: StationBuildError['code']) {
    super(code)
    this.code = code
  }
}

type CreateStationBuildingInput = {
  buildingType: string
  slotIndex: number
}

type UpgradeStationBuildingInput = {
  buildingId: string
}

const uuidLikePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isTemporaryBuildableBuildingId(value: string): value is TemporaryBuildableBuildingId {
  return temporaryBuildableBuildings.some((building) => building.id === value)
}

function resolveBuildableBuildings(existingBuildingTypes: Set<string>) {
  return temporaryBuildableBuildings.filter((building) => !existingBuildingTypes.has(building.id))
}

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

  const buildingRows = await services.db
    .select({
      id: stationBuildings.id,
      building_type: stationBuildings.buildingType,
      level: stationBuildings.level,
      upgrade_started_at: stationBuildings.upgradeStartedAt,
      slot_index: stationBuildings.slotIndex,
    })
    .from(stationBuildings)
    .where(eq(stationBuildings.stationId, stationRow.id))
    .orderBy(asc(stationBuildings.slotIndex))
  const buildingTypes = new Set(buildingRows.map((row) => row.building_type))

  return {
    id: stationRow.id,
    x: stationRow.x,
    y: stationRow.y,
    inventory: inventoryRows.map((row) => ({
      resource_key: row.resource_key,
      amount: Number(row.amount),
    })),
    buildings: buildingRows.map((row) => ({
      id: row.id,
      building_type: row.building_type,
      level: row.level,
      status: row.upgrade_started_at ? 'upgrading' : 'idle',
      upgrade_finish_at: row.upgrade_started_at
        ? new Date(row.upgrade_started_at.getTime() + BUILDING_UPGRADE_DURATION_MS).toISOString()
        : null,
      slot_index: row.slot_index,
    })),
    buildable_buildings: resolveBuildableBuildings(buildingTypes),
  }
}

export async function createStationBuildingForPlayer(
  services: AppServices,
  playerId: string,
  input: CreateStationBuildingInput,
): Promise<StationSnapshotResponse> {
  if (
    !Number.isInteger(input.slotIndex) ||
    input.slotIndex < 1 ||
    input.slotIndex > STATION_SLOT_COUNT
  ) {
    throw new StationBuildError('invalid_slot_index')
  }

  if (!isTemporaryBuildableBuildingId(input.buildingType)) {
    throw new StationBuildError('unsupported_building_type')
  }

  await services.db.transaction(async (tx) => {
    const [stationIdRow] = await tx
      .select({
        id: stations.id,
      })
      .from(stations)
      .where(eq(stations.playerId, playerId))
      .limit(1)

    if (!stationIdRow) {
      throw new StationBuildError('station_not_found')
    }

    // Serialize slot assignment updates per station row.
    await tx.execute(sql`select id from stations where id = ${stationIdRow.id} for update`)

    const [stationRow] = await tx
      .select({
        id: stations.id,
      })
      .from(stations)
      .where(eq(stations.id, stationIdRow.id))
      .limit(1)

    if (!stationRow) {
      throw new StationBuildError('station_not_found')
    }

    const buildingRows = await tx
      .select({
        id: stationBuildings.id,
        buildingType: stationBuildings.buildingType,
        slotIndex: stationBuildings.slotIndex,
      })
      .from(stationBuildings)
      .where(eq(stationBuildings.stationId, stationRow.id))

    if (buildingRows.some((row) => row.buildingType === input.buildingType)) {
      throw new StationBuildError('building_type_already_exists')
    }

    if (buildingRows.some((row) => row.slotIndex === input.slotIndex)) {
      throw new StationBuildError('slot_occupied')
    }

    try {
      await tx.insert(stationBuildings).values({
        stationId: stationRow.id,
        slotIndex: input.slotIndex,
        buildingType: input.buildingType,
        level: 1,
      })
    } catch (error: any) {
      if (error?.code === '23505') {
        if (error?.constraint === 'station_buildings_station_slot_unique_idx') {
          throw new StationBuildError('slot_occupied')
        }
        throw new StationBuildError('building_type_already_exists')
      }

      throw error
    }
  })

  const snapshot = await getStationSnapshotForPlayer(services, playerId)
  if (!snapshot) {
    throw new StationBuildError('station_not_found')
  }

  return snapshot
}

export async function upgradeStationBuildingForPlayer(
  services: AppServices,
  playerId: string,
  input: UpgradeStationBuildingInput,
): Promise<StationSnapshotResponse> {
  if (!uuidLikePattern.test(input.buildingId)) {
    throw new StationBuildError('building_not_found')
  }

  const [stationRow] = await services.db
    .select({
      id: stations.id,
    })
    .from(stations)
    .where(eq(stations.playerId, playerId))
    .limit(1)

  if (!stationRow) {
    throw new StationBuildError('station_not_found')
  }

  const now = new Date()
  const dueAt = new Date(now.getTime() + BUILDING_UPGRADE_DURATION_MS)
  const upgradeStartedAtIso = now.toISOString()
  const upgradeEventIdempotencyKey = `station_building_upgrade:${input.buildingId}:${upgradeStartedAtIso}`

  await services.db.transaction(async (tx) => {
    // Serialize concurrent upgrades targeting the same building row.
    await tx.execute(
      sql`select id from station_buildings where id = ${input.buildingId} and station_id = ${stationRow.id} for update`,
    )

    const [buildingRow] = await tx
      .select({
        id: stationBuildings.id,
        upgradeStartedAt: stationBuildings.upgradeStartedAt,
      })
      .from(stationBuildings)
      .where(
        and(
          eq(stationBuildings.id, input.buildingId),
          eq(stationBuildings.stationId, stationRow.id),
        ),
      )
      .limit(1)

    if (!buildingRow) {
      throw new StationBuildError('building_not_found')
    }

    if (buildingRow.upgradeStartedAt) {
      throw new StationBuildError('building_already_upgrading')
    }

    await tx
      .update(stationBuildings)
      .set({
        upgradeStartedAt: now,
        updatedAt: now,
      })
      .where(eq(stationBuildings.id, input.buildingId))

    await tx.insert(domainEvents).values({
      stationId: stationRow.id,
      eventType: STATION_BUILDING_UPGRADE_FINALIZE_EVENT_TYPE,
      payloadJson: {
        building_id: input.buildingId,
        upgrade_started_at: upgradeStartedAtIso,
      },
      idempotencyKey: upgradeEventIdempotencyKey,
      dueAt,
    })
  })

  const snapshot = await getStationSnapshotForPlayer(services, playerId)
  if (!snapshot) {
    throw new StationBuildError('station_not_found')
  }

  return snapshot
}
