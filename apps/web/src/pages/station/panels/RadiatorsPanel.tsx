import type { StationPanelProps } from './types'
import { BuildingPanelShell } from './BuildingPanelShell'

type RadiatorsPanelData = {
  buildingId: string
  slotIndex: number
  level: number
  status: 'idle' | 'upgrading'
}

export function RadiatorsPanel({ data, context }: StationPanelProps<RadiatorsPanelData>) {
  return (
    <BuildingPanelShell
      title="Radiators"
      placeholder="Radiator controls placeholder."
      data={data}
      context={context}
    />
  )
}
