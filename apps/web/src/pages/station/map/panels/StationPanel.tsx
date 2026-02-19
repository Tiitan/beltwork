import type { MapStation } from '../../../../types/app'
import { formatCoordinates } from './panelUtils'

type StationPanelProps = {
  station: MapStation
}

export function StationPanel({ station }: StationPanelProps) {
  return (
    <div className="grid gap-3">
      <h3 className="text-lg text-sky-100">Station</h3>
      <div className="rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-200">
        <p className="font-semibold text-sky-100">{station.name}</p>
        <p>{formatCoordinates(station.x, station.y)}</p>
      </div>
    </div>
  )
}
