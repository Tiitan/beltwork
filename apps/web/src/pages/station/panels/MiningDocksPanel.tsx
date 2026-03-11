import type { StationPanelProps } from './types'
import { BuildingPanelShell } from './BuildingPanelShell'

type MiningDocksPanelData = {
  buildingId: string
  slotIndex: number
  level: number
  status: 'idle' | 'upgrading'
}

export function MiningDocksPanel({ data, context }: StationPanelProps<MiningDocksPanelData>) {
  return (
    <BuildingPanelShell
      title="Mining Docks"
      placeholder="Mining docks controls placeholder."
      data={data}
      context={context}
      showGoToMap
    />
  )
}
