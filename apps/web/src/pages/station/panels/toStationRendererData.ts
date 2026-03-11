import type { StationSlotEntity } from './types'

export type EmptySlotRendererData = {
  slotIndex: number
  width: number
  height: number
}

export type BuildingSlotRendererData = {
  buildingId: string
  slotIndex: number
  width: number
  height: number
  buildingType: string
  level: number
  status: 'idle' | 'upgrading'
}

export type StationRendererData = EmptySlotRendererData | BuildingSlotRendererData

export function toStationRendererData(entity: StationSlotEntity): StationRendererData {
  if (entity.kind === 'empty_slot') {
    return {
      slotIndex: entity.slot.slotIndex,
      width: entity.slot.width,
      height: entity.slot.height,
    }
  }

  return {
    buildingId: entity.building.id,
    slotIndex: entity.slot.slotIndex,
    width: entity.slot.width,
    height: entity.slot.height,
    buildingType: entity.building.type,
    level: entity.building.level,
    status: entity.building.status,
  }
}
