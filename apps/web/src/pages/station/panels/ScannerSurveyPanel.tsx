import type { StationPanelProps } from './types'
import { BuildingPanelShell } from './BuildingPanelShell'

type ScannerSurveyPanelData = {
  buildingId: string
  slotIndex: number
  level: number
  status: 'idle' | 'upgrading'
}

export function ScannerSurveyPanel({ data, context }: StationPanelProps<ScannerSurveyPanelData>) {
  return (
    <BuildingPanelShell
      title="Scanner and Survey"
      placeholder="Scanner and survey controls placeholder."
      data={data}
      context={context}
      showGoToMap
    />
  )
}
