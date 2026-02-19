import { useState } from 'react'
import { scanAsteroid } from '../../../../features/station/api'
import { useStation } from '../../../../features/station/useStation'
import type { MapAsteroid, MapPanelContext } from '../../../../types/app'
import { formatCoordinates } from './panelUtils'

type AsteroidPanelProps = {
  asteroid: MapAsteroid
  context: MapPanelContext
}

export function AsteroidPanel({ asteroid }: AsteroidPanelProps) {
  const isScanned = asteroid.isScanned
  const label = isScanned ? (asteroid.name ?? 'Unknown Asteroid') : 'Unknown Asteroid'
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const { refreshMapSnapshot } = useStation()

  async function handleScanAsteroid() {
    try {
      await scanAsteroid(asteroid.id)
      try {
        await refreshMapSnapshot()
      } catch {
        // Keep success message if scan worked even if refresh request fails.
      }
      setActionMessage(`Scan completed for target ${asteroid.id}.`)
    } catch {
      setActionMessage(`Scan failed for target ${asteroid.id}.`)
    }
  }

  async function handleDeployMiningRig() {
    const message = `Deploy mining rig not implemented yet for target ${asteroid.id}.`
    console.info(message)
    setActionMessage(message)
  }

  return (
    <div className="grid gap-3">
      <h3 className="text-lg text-sky-100">Asteroid</h3>
      <div className="rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-200">
        <p className="font-semibold text-sky-100">{label}</p>
        <p>{formatCoordinates(asteroid.x, asteroid.y)}</p>
      </div>

      {isScanned ? (
        <div className="rounded-md border border-emerald-400/30 bg-emerald-950/25 p-3 text-sm text-emerald-100">
          <p>Yield multiplier: {asteroid.yieldMultiplier ?? 'n/a'}</p>
          <p>Remaining units (scan): {asteroid.scannedRemainingUnits ?? 'n/a'}</p>
          <p>Scanned at: {formatTimestamp(asteroid.scannedAt)}</p>
        </div>
      ) : (
        <div className="rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-300">
          <p>Yield multiplier: Unknown (scan required)</p>
          <p>Remaining units: Unknown (scan required)</p>
          <p>Resources: Unknown (scan required)</p>
        </div>
      )}

      {isScanned ? (
        <div className="rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-200">
          <p className="mb-2 font-semibold text-sky-100">Resources</p>
          {renderComposition(asteroid.composition)}
        </div>
      ) : null}

      <div className="grid gap-2 rounded-md border border-slate-400/30 bg-slate-900/55 p-3">
        <p className="text-sm font-semibold text-sky-100">Actions</p>
        <button
          type="button"
          className="rounded-md border border-slate-300/35 bg-slate-800/75 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-700/80"
          onClick={() => {
            void handleScanAsteroid()
          }}
        >
          Scan
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300/35 bg-slate-800/75 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-700/80"
          onClick={() => {
            void handleDeployMiningRig()
          }}
        >
          Deploy mining rig
        </button>
        {actionMessage ? <p className="text-xs text-amber-200">{actionMessage}</p> : null}
      </div>
    </div>
  )
}

function formatTimestamp(value: string | undefined) {
  if (!value) {
    return 'n/a'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'n/a'
  }

  return parsed.toLocaleString()
}

function formatResourceLabel(resourceKey: string) {
  return resourceKey
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

function renderComposition(composition: Record<string, number> | undefined) {
  if (!composition) {
    return <p className="text-slate-300">Unavailable</p>
  }

  const entries = Object.entries(composition)
  if (entries.length === 0) {
    return <p className="text-slate-300">Unavailable</p>
  }

  return (
    <ul className="grid gap-1 text-sm">
      {entries
        .sort((a, b) => b[1] - a[1])
        .map(([resourceKey, ratio]) => (
          <li key={resourceKey} className="flex items-center justify-between gap-2">
            <span>{formatResourceLabel(resourceKey)}</span>
            <span>{(ratio * 100).toFixed(0)}%</span>
          </li>
        ))}
    </ul>
  )
}
