import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resolveAuth } from '../services/auth.service.js'
import {
  createStationBuildingForPlayer,
  getStationSnapshotForPlayer,
  StationBuildError,
  upgradeStationBuildingForPlayer,
} from '../services/station.service.js'
import type { AppServices } from '../types/api.js'

export function registerStationRoutes(app: FastifyInstance, services: AppServices): void {
  async function handleStation(request: any, reply: any) {
    const auth = await resolveAuth(services, request)
    if (!auth) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const snapshot = await getStationSnapshotForPlayer(services, auth.playerId)
    if (!snapshot) {
      return reply.code(404).send({ error: 'station_not_found' })
    }

    return snapshot
  }

  async function handleCreateBuilding(request: any, reply: any) {
    const auth = await resolveAuth(services, request)
    if (!auth) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const body = z
      .object({
        building_type: z.string().min(1),
        slot_index: z.number().int().min(1).max(10),
      })
      .safeParse(request.body)

    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: body.error.issues,
      })
    }

    try {
      const snapshot = await createStationBuildingForPlayer(services, auth.playerId, {
        buildingType: body.data.building_type,
        slotIndex: body.data.slot_index,
      })

      return snapshot
    } catch (error) {
      if (!(error instanceof StationBuildError)) {
        throw error
      }

      if (error.code === 'station_not_found') {
        return reply.code(404).send({ error: error.code })
      }

      if (error.code === 'unsupported_building_type') {
        return reply.code(400).send({ error: error.code })
      }

      if (error.code === 'invalid_slot_index') {
        return reply.code(400).send({ error: error.code })
      }

      return reply.code(409).send({ error: error.code })
    }
  }

  async function handleUpgradeBuilding(request: any, reply: any) {
    const auth = await resolveAuth(services, request)
    if (!auth) {
      return reply.code(401).send({ error: 'unauthorized' })
    }

    const params = z
      .object({
        buildingId: z.string().min(1),
      })
      .safeParse(request.params)

    if (!params.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: params.error.issues,
      })
    }

    const body = z
      .object({
        action: z.literal('upgrade'),
      })
      .safeParse(request.body)

    if (!body.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: body.error.issues,
      })
    }

    try {
      const snapshot = await upgradeStationBuildingForPlayer(services, auth.playerId, {
        buildingId: params.data.buildingId,
      })

      return snapshot
    } catch (error) {
      if (!(error instanceof StationBuildError)) {
        throw error
      }

      if (error.code === 'station_not_found' || error.code === 'building_not_found') {
        return reply.code(404).send({ error: error.code })
      }

      if (error.code === 'building_already_upgrading') {
        return reply.code(409).send({ error: error.code })
      }

      return reply.code(400).send({ error: error.code })
    }
  }

  app.get('/v1/station', handleStation)
  app.post('/v1/station/buildings', handleCreateBuilding)
  app.patch('/v1/station/buildings/:buildingId', handleUpgradeBuilding)
}
