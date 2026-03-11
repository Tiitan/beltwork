import type { StationPanelProps } from './types'
import { BuildingPanelShell } from './BuildingPanelShell'

type AssemblerPanelData = {
  buildingId: string
  slotIndex: number
  level: number
  status: 'idle' | 'upgrading'
}

export function AssemblerPanel({ data, context }: StationPanelProps<AssemblerPanelData>) {
  return (
    <BuildingPanelShell
      title="Assembler"
      placeholder="Assembler controls placeholder."
      data={data}
      context={context}
    />
  )
}
