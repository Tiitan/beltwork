import type { StationPanelProps } from './types'
import { BuildingPanelShell } from './BuildingPanelShell'

type FusionReactorPanelData = {
  buildingId: string
  slotIndex: number
  level: number
  status: 'idle' | 'upgrading'
}

export function FusionReactorPanel({ data, context }: StationPanelProps<FusionReactorPanelData>) {
  return (
    <BuildingPanelShell
      title="Fusion Reactor"
      placeholder="Fusion reactor controls placeholder."
      data={data}
      context={context}
    />
  )
}
