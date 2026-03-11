import { getResourceIconPath, iconFallbackPaths } from '../../../features/station/iconPaths'
import type { StationPanelProps } from './types'
import { BuildingPanelShell } from './BuildingPanelShell'

type StoragePanelData = {
  buildingId: string
  slotIndex: number
  level: number
  status: 'idle' | 'upgrading'
}

function formatResourceName(resourceKey: string) {
  return resourceKey
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatResourceAmount(amount: number) {
  if (Number.isInteger(amount)) {
    return new Intl.NumberFormat('en-US').format(amount)
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(amount)
}

export function StoragePanel({ data, context }: StationPanelProps<StoragePanelData>) {
  return (
    <BuildingPanelShell
      title="Storage"
      placeholder="Station inventory overview."
      data={data}
      context={context}
    >
      <div className="grid gap-2 rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-100">
        <p className="m-0 text-slate-200">Inventory</p>

        {context.inventory.length > 0 ? (
          <ul className="m-0 grid list-none gap-2 p-0">
            {context.inventory.map((resource) => (
              <li key={resource.resourceKey} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <img
                    src={getResourceIconPath(resource.resourceKey)}
                    alt={`${formatResourceName(resource.resourceKey)} icon`}
                    className="h-7 w-7 shrink-0 rounded-sm border border-slate-500/40 bg-slate-900/60 object-cover"
                    onError={(event) => {
                      if (event.currentTarget.src.endsWith(iconFallbackPaths.resource)) {
                        return
                      }
                      event.currentTarget.src = iconFallbackPaths.resource
                    }}
                  />
                  <span className="truncate">{formatResourceName(resource.resourceKey)}</span>
                </span>
                <span className="font-medium text-slate-200">
                  {formatResourceAmount(resource.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-slate-300">No inventory available.</p>
        )}
      </div>
    </BuildingPanelShell>
  )
}
