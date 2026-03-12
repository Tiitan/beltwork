import type { ReactNode } from 'react'
import type {
  ActiveMiningOperationRow,
  BuildableBuildingRow,
  BuildingRow,
  InventoryRow,
} from '../../../types/app'
import type { StationSlotLayout } from '../slotLayout'

export type StationSlotEntity =
  | {
      kind: 'empty_slot'
      slot: StationSlotLayout
    }
  | {
      kind: 'building_slot'
      slot: StationSlotLayout
      building: BuildingRow
    }

export type StationSlotEntityRef = {
  slotIndex: number
}

export type StationPanelContext = {
  inventory: InventoryRow[]
  buildableBuildings: BuildableBuildingRow[]
  miningRigCapacity: number
  activeMiningOperations: ActiveMiningOperationRow[]
  uiNowMs: number
  isActionPending: boolean
  actionError: string | null
  onBuildBuilding: (slotIndex: number, buildingType: string) => Promise<void>
  onUpgradeBuilding: (buildingId: string) => Promise<void>
  onRecallMiningOperation: (operationId: string) => Promise<void>
  onGoToMap: () => void
}

export type StationPanelProps<TData> = {
  data: TData
  context: StationPanelContext
}

export type StationEntityRenderer<TData> = {
  kind: StationSlotEntity['kind']
  getLabel: (data: TData) => string
  getTooltip: (data: TData) => ReactNode
  getHitRadius: (data: TData, scale: number) => number
  renderPanel: (props: StationPanelProps<TData>) => ReactNode
}
