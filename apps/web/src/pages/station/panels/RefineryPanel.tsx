import type { StationPanelProps } from './types'
import { BuildingPanelShell } from './BuildingPanelShell'

type RefineryPanelData = {
  buildingId: string
  slotIndex: number
  level: number
  status: 'idle' | 'upgrading'
}

export function RefineryPanel({ data, context }: StationPanelProps<RefineryPanelData>) {
  return (
    <BuildingPanelShell
      title="Refinery"
      placeholder="Refinery controls placeholder."
      data={data}
      context={context}
    />
  )
}
