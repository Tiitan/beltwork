import type { ReactNode } from 'react'
import { AssemblerPanel } from './AssemblerPanel'
import { FusionReactorPanel } from './FusionReactorPanel'
import { LifeSupportPanel } from './LifeSupportPanel'
import { MiningDocksPanel } from './MiningDocksPanel'
import { RadiatorsPanel } from './RadiatorsPanel'
import { RefineryPanel } from './RefineryPanel'
import { ScannerSurveyPanel } from './ScannerSurveyPanel'
import { StoragePanel } from './StoragePanel'
import type { StationPanelProps } from './types'
import { UnknownBuildingPanel } from './UnknownBuildingPanel'

type BuildingPanelData = {
  buildingId: string
  buildingType: string
  slotIndex: number
  level: number
  status: 'idle' | 'upgrading'
}

type BuildingPanelComponent = (props: StationPanelProps<any>) => ReactNode

const buildingPanelByType: Record<string, BuildingPanelComponent> = {
  fusion_reactor: FusionReactorPanel,
  life_support: LifeSupportPanel,
  radiators: RadiatorsPanel,
  mining_docks: MiningDocksPanel,
  scanner_survey: ScannerSurveyPanel,
  refinery: RefineryPanel,
  assembler: AssemblerPanel,
  storage: StoragePanel,
}

export function renderBuildingPanel(props: StationPanelProps<BuildingPanelData>) {
  const PanelComponent = buildingPanelByType[props.data.buildingType]
  if (PanelComponent) {
    return <PanelComponent {...props} />
  }

  return <UnknownBuildingPanel {...props} />
}
