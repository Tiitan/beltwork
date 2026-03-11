import type { ReactNode } from 'react'
import type { StationPanelContext } from './types'

type BuildingPanelShellProps = {
  title: string
  placeholder: string
  data: {
    buildingId: string
    slotIndex: number
    level: number
    status: 'idle' | 'upgrading'
  }
  context: StationPanelContext
  showGoToMap?: boolean
  children?: ReactNode
}

export function BuildingPanelShell({
  title,
  placeholder,
  data,
  context,
  showGoToMap = false,
  children,
}: BuildingPanelShellProps) {
  return (
    <div className="grid gap-3">
      <h3 className="text-lg text-sky-100">{title}</h3>
      <div className="rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-200">
        <p className="m-0">Slot: {data.slotIndex}</p>
        <p className="m-0">Level: {data.level}</p>
        <p className="m-0">Status: {data.status}</p>
      </div>

      {children}

      <p className="text-sm text-slate-300">{placeholder}</p>

      {context.actionError ? <p className="text-sm text-red-300">{context.actionError}</p> : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={context.isActionPending}
          className="rounded-md border border-slate-300/35 bg-slate-800/75 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-700/80 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            void context.onUpgradeBuilding(data.buildingId)
          }}
        >
          {context.isActionPending ? 'Upgrading...' : 'Upgrade'}
        </button>

        {showGoToMap ? (
          <button
            type="button"
            className="rounded-md border border-slate-300/35 bg-slate-800/75 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-700/80"
            onClick={context.onGoToMap}
          >
            Go to Map
          </button>
        ) : null}
      </div>
    </div>
  )
}
