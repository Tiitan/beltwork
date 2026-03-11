import type { StationPanelProps } from './types'
import { getBuildingIconPath, iconFallbackPaths } from '../../../features/station/iconPaths'

type EmptySlotPanelData = {
  slotIndex: number
}

export function EmptySlotPanel({ data, context }: StationPanelProps<EmptySlotPanelData>) {
  return (
    <div className="grid gap-3">
      <h3 className="text-lg text-sky-100">Empty slot #{data.slotIndex}</h3>
      <div className="rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-200">
        <p className="m-0">Buildable buildings</p>
      </div>

      {context.buildableBuildings.length > 0 ? (
        <div className="grid gap-2">
          {context.buildableBuildings.map((building) => (
            <button
              key={building.id}
              type="button"
              disabled={context.isActionPending}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-300/35 bg-slate-800/75 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-700/80 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void context.onBuildBuilding(data.slotIndex, building.id)
              }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <img
                  src={getBuildingIconPath(building.id)}
                  alt={`${building.name} icon`}
                  className="h-8 w-8 shrink-0 rounded-sm border border-slate-500/40 bg-slate-900/60 object-cover"
                  onError={(event) => {
                    if (event.currentTarget.src.endsWith(iconFallbackPaths.building)) {
                      return
                    }
                    event.currentTarget.src = iconFallbackPaths.building
                  }}
                />
                <span className="truncate">{building.name}</span>
              </span>
              <span className="text-xs text-slate-300">
                {context.isActionPending ? 'Building...' : 'Build'}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-300">No buildable buildings available.</p>
      )}
    </div>
  )
}
