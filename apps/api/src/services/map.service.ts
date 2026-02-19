import { eq } from 'drizzle-orm'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { asteroid, players, scannedAsteroids, stations } from '../db/schema.js'
import type { AppServices, MapSnapshotResponse } from '../types/api.js'

const asteroidTemplatesSchema = z.object({
  asteroid_templates: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      yield_multiplier: z.number(),
      composition: z.record(z.string(), z.number()),
    }),
  ),
})

async function loadAsteroidTemplatesMap() {
  const asteroidConfigFileUrl = new URL('../../../../gameconfig/asteroids.json', import.meta.url)
  const raw = await readFile(asteroidConfigFileUrl, 'utf8')
  const parsed = asteroidTemplatesSchema.parse(JSON.parse(raw) as unknown)
  return new Map(parsed.asteroid_templates.map((template) => [template.id, template]))
}

export async function getMapSnapshotForPlayer(
  services: AppServices,
  playerId: string,
): Promise<MapSnapshotResponse> {
  const templateById = await loadAsteroidTemplatesMap()
  const stationRows = await services.db
    .select({
      id: stations.id,
      playerId: stations.playerId,
      x: stations.x,
      y: stations.y,
    })
    .from(stations)

  const playerRows = await services.db
    .select({
      id: players.id,
      displayName: players.displayName,
    })
    .from(players)

  const playerNameById = new Map(playerRows.map((row) => [row.id, row.displayName]))

  const asteroidRows = await services.db
    .select({
      id: asteroid.id,
      x: asteroid.x,
      y: asteroid.y,
      templateId: asteroid.templateId,
    })
    .from(asteroid)
    .where(eq(asteroid.isDepleted, false))

  const scanRows = await services.db
    .select({
      asteroidId: scannedAsteroids.asteroidId,
      remainingUnits: scannedAsteroids.remainingUnits,
      scannedAt: scannedAsteroids.scannedAt,
    })
    .from(scannedAsteroids)
    .where(eq(scannedAsteroids.playerId, playerId))

  const scanByAsteroidId = new Map(
    scanRows.map((row) => [
      row.asteroidId,
      {
        remainingUnits: row.remainingUnits,
        scannedAt: row.scannedAt,
      },
    ]),
  )

  return {
    stations: stationRows.map((stationRow) => ({
      id: stationRow.id,
      x: stationRow.x,
      y: stationRow.y,
      name: playerNameById.get(stationRow.playerId) ?? 'Unknown Station',
    })),
    asteroids: asteroidRows.map((row) => {
      const scan = scanByAsteroidId.get(row.id)
      if (!scan) {
        return {
          id: row.id,
          x: row.x,
          y: row.y,
          is_scanned: false,
        }
      }

      const template = templateById.get(row.templateId)
      return {
        id: row.id,
        x: row.x,
        y: row.y,
        is_scanned: true,
        name: template?.name,
        yield_multiplier: template?.yield_multiplier,
        composition: template?.composition,
        template_id: row.templateId,
        scanned_remaining_units: scan.remainingUnits,
        scanned_at: scan.scannedAt.toISOString(),
      }
    }),
  }
}
