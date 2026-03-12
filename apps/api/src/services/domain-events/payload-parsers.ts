import { z } from 'zod'

const upgradeFinalizePayloadSchema = z.object({
  building_id: z.string().min(1),
  upgrade_started_at: z.string().min(1),
})

const miningOperationPhasePayloadSchema = z.object({
  operation_id: z.string().min(1),
  phase_started_at: z.string().min(1),
})

export type UpgradeFinalizePayload = {
  buildingId: string
  upgradeStartedAt: Date
}

export type MiningOperationPhasePayload = {
  operationId: string
  phaseStartedAt: Date
}

function toValidDate(value: string): Date | null {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function parseUpgradeFinalizePayload(payload: unknown): UpgradeFinalizePayload | null {
  const parsedPayload = upgradeFinalizePayloadSchema.safeParse(payload)
  if (!parsedPayload.success) {
    return null
  }

  const upgradeStartedAt = toValidDate(parsedPayload.data.upgrade_started_at)
  if (!upgradeStartedAt) {
    return null
  }

  return {
    buildingId: parsedPayload.data.building_id,
    upgradeStartedAt,
  }
}

export function parseMiningOperationPhasePayload(
  payload: unknown,
): MiningOperationPhasePayload | null {
  const parsedPayload = miningOperationPhasePayloadSchema.safeParse(payload)
  if (!parsedPayload.success) {
    return null
  }

  const phaseStartedAt = toValidDate(parsedPayload.data.phase_started_at)
  if (!phaseStartedAt) {
    return null
  }

  return {
    operationId: parsedPayload.data.operation_id,
    phaseStartedAt,
  }
}
