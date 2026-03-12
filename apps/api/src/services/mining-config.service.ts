import { readFile } from 'node:fs/promises'
import { z } from 'zod'

const buildingsConfigSchema = z.object({
  buildings: z.array(
    z.object({
      id: z.string().min(1),
      operational_rules: z
        .object({
          rig: z
            .object({
              cargo_units: z.number().int().positive(),
              move_speed_units_per_min: z.number().positive(),
              mining_speed_units_per_min: z.number().positive(),
            })
            .optional(),
        })
        .optional(),
      level_scaling: z
        .array(
          z.object({
            stat: z.string().min(1),
            base: z.number().optional(),
            per_level_add_every_n_levels: z.number().int().positive().optional(),
            add_value: z.number().int().positive().optional(),
          }),
        )
        .default([]),
    }),
  ),
})

const asteroidConfigSchema = z.object({
  asteroid_templates: z.array(
    z.object({
      id: z.string().min(1),
      composition: z.record(z.string(), z.number().nonnegative()),
    }),
  ),
})

export type MiningDockRigConfig = {
  cargoUnits: number
  moveSpeedUnitsPerMin: number
  miningSpeedUnitsPerMin: number
  maxActiveRigsBase: number
  maxActiveRigsAddEveryNLevels: number
  maxActiveRigsAddValue: number
}

let cachedMiningDockConfigPromise: Promise<MiningDockRigConfig> | null = null
let cachedAsteroidCompositionByTemplatePromise: Promise<
  Map<string, Record<string, number>>
> | null = null

function parseMiningDockConfig(raw: unknown): MiningDockRigConfig {
  const parsed = buildingsConfigSchema.parse(raw)
  const miningDock = parsed.buildings.find((building) => building.id === 'mining_docks')

  if (!miningDock?.operational_rules?.rig) {
    throw new Error('invalid_mining_dock_rig_config')
  }

  const maxActiveRigsScaling = miningDock.level_scaling.find(
    (entry) => entry.stat === 'max_active_rigs',
  )
  if (
    !maxActiveRigsScaling ||
    typeof maxActiveRigsScaling.base !== 'number' ||
    typeof maxActiveRigsScaling.per_level_add_every_n_levels !== 'number' ||
    typeof maxActiveRigsScaling.add_value !== 'number'
  ) {
    throw new Error('invalid_mining_dock_capacity_scaling')
  }

  return {
    cargoUnits: miningDock.operational_rules.rig.cargo_units,
    moveSpeedUnitsPerMin: miningDock.operational_rules.rig.move_speed_units_per_min,
    miningSpeedUnitsPerMin: miningDock.operational_rules.rig.mining_speed_units_per_min,
    maxActiveRigsBase: maxActiveRigsScaling.base,
    maxActiveRigsAddEveryNLevels: maxActiveRigsScaling.per_level_add_every_n_levels,
    maxActiveRigsAddValue: maxActiveRigsScaling.add_value,
  }
}

export async function loadMiningDockRigConfig(): Promise<MiningDockRigConfig> {
  if (!cachedMiningDockConfigPromise) {
    cachedMiningDockConfigPromise = (async () => {
      const configFileUrl = new URL('../../../../gameconfig/buildings.json', import.meta.url)
      const raw = await readFile(configFileUrl, 'utf8')
      return parseMiningDockConfig(JSON.parse(raw) as unknown)
    })()
  }

  return cachedMiningDockConfigPromise
}

export function miningRigCapacityForLevel(level: number, config: MiningDockRigConfig): number {
  const normalizedLevel = Math.max(1, Math.floor(level))
  const additionalSteps = Math.floor((normalizedLevel - 1) / config.maxActiveRigsAddEveryNLevels)
  return config.maxActiveRigsBase + additionalSteps * config.maxActiveRigsAddValue
}

export function travelDurationMs(distanceUnits: number, moveSpeedUnitsPerMin: number): number {
  if (!Number.isFinite(distanceUnits) || distanceUnits <= 0) {
    return 0
  }

  return Math.max(0, Math.ceil((distanceUnits / moveSpeedUnitsPerMin) * 60_000))
}

export function miningDurationMs(quantityUnits: number, miningSpeedUnitsPerMin: number): number {
  if (!Number.isFinite(quantityUnits) || quantityUnits <= 0) {
    return 0
  }

  return Math.max(0, Math.ceil((quantityUnits / miningSpeedUnitsPerMin) * 60_000))
}

export function minedQuantityByElapsedMs(
  elapsedMs: number,
  quantityTarget: number,
  miningSpeedUnitsPerMin: number,
): number {
  if (quantityTarget <= 0 || elapsedMs <= 0) {
    return 0
  }

  const mined = Math.floor((elapsedMs / 60_000) * miningSpeedUnitsPerMin)
  return Math.max(0, Math.min(quantityTarget, mined))
}

export async function loadAsteroidCompositionByTemplateId(): Promise<
  Map<string, Record<string, number>>
> {
  if (!cachedAsteroidCompositionByTemplatePromise) {
    cachedAsteroidCompositionByTemplatePromise = (async () => {
      const configFileUrl = new URL('../../../../gameconfig/asteroids.json', import.meta.url)
      const raw = await readFile(configFileUrl, 'utf8')
      const parsed = asteroidConfigSchema.parse(JSON.parse(raw) as unknown)
      return new Map(
        parsed.asteroid_templates.map((template) => [template.id, template.composition]),
      )
    })()
  }

  return cachedAsteroidCompositionByTemplatePromise
}
