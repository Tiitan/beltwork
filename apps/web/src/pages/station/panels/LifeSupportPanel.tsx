import type { StationPanelProps } from './types'
import { BuildingPanelShell } from './BuildingPanelShell'

type LifeSupportPanelData = {
  buildingId: string
  slotIndex: number
  level: number
  status: 'idle' | 'upgrading'
}

export function LifeSupportPanel({ data, context }: StationPanelProps<LifeSupportPanelData>) {
  return (
    <BuildingPanelShell
      title="Life Support"
      placeholder="Life support controls placeholder."
      data={data}
      context={context}
    />
  )
}
