import type { StationPanelProps } from './types'
import { BuildingPanelShell } from './BuildingPanelShell'

type UnknownBuildingPanelData = {
  buildingId: string
  buildingType: string
  slotIndex: number
  level: number
  status: 'idle' | 'upgrading'
}

export function UnknownBuildingPanel({
  data,
  context,
}: StationPanelProps<UnknownBuildingPanelData>) {
  return (
    <BuildingPanelShell
      title="Building"
      placeholder="No specialized panel is available yet."
      data={data}
      context={context}
    >
      <div className="rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-200">
        <p className="m-0">Type: {data.buildingType}</p>
      </div>
    </BuildingPanelShell>
  )
}
