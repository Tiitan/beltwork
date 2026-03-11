import { EmptySlotPanel } from './EmptySlotPanel'
import { renderBuildingPanel } from './buildingPanels'
import type { StationEntityRenderer, StationSlotEntity } from './types'

const emptySlotRenderer: StationEntityRenderer<{
  slotIndex: number
  width: number
  height: number
}> = {
  kind: 'empty_slot',
  getLabel: (data) => `Empty slot #${data.slotIndex}`,
  getTooltip: (data) => (
    <>
      <p className="m-0 font-semibold text-sky-100">Slot #{data.slotIndex}</p>
      <p className="m-0">Empty</p>
    </>
  ),
  getHitRadius: (data) => Math.min(data.width, data.height) * 0.5,
  renderPanel: ({ data, context }) => (
    <EmptySlotPanel data={{ slotIndex: data.slotIndex }} context={context} />
  ),
}

const buildingSlotRenderer: StationEntityRenderer<{
  buildingId: string
  slotIndex: number
  width: number
  height: number
  buildingType: string
  level: number
  status: 'idle' | 'upgrading'
}> = {
  kind: 'building_slot',
  getLabel: (data) => `${data.buildingType} (L${data.level})`,
  getTooltip: (data) => (
    <>
      <p className="m-0 font-semibold text-sky-100">{data.buildingType}</p>
      <p className="m-0">Slot #{data.slotIndex}</p>
      <p className="m-0">Level {data.level}</p>
    </>
  ),
  getHitRadius: (data) => Math.min(data.width, data.height) * 0.5,
  renderPanel: ({ data, context }) =>
    renderBuildingPanel({
      data: {
        buildingId: data.buildingId,
        buildingType: data.buildingType,
        slotIndex: data.slotIndex,
        level: data.level,
        status: data.status,
      },
      context,
    }),
}

const renderers: Record<StationSlotEntity['kind'], StationEntityRenderer<any>> = {
  empty_slot: emptySlotRenderer,
  building_slot: buildingSlotRenderer,
}

export function resolveRendererForStationEntity(entity: StationSlotEntity) {
  return renderers[entity.kind]
}
