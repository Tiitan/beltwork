import type { ActiveMiningOperationRow } from '../../types/app'

type MiningOperationCardProps = {
  operation: ActiveMiningOperationRow
  uiNowMs: number
  isActionPending: boolean
  onRecall: (operationId: string) => void
  showAsteroidId?: boolean
}

export function MiningOperationCard({
  operation,
  uiNowMs,
  isActionPending,
  onRecall,
  showAsteroidId = true,
}: MiningOperationCardProps) {
  const progress = operationProgress(operation, uiNowMs)
  const miningRemaining = liveMiningRemaining(operation, progress)
  const displayCargo = liveCargoAmount(operation, progress)
  const canRecall = operation.status === 'flying_to_destination' || operation.status === 'mining'

  return (
    <li className="grid gap-2 rounded-md border border-slate-600/35 bg-slate-900/70 p-2">
      <p className="m-0 text-xs text-slate-300">Op #{operation.id.slice(0, 8)}</p>
      <p className="m-0 font-semibold text-sky-100">{statusLabel(operation.status)}</p>
      {showAsteroidId ? (
        <p className="m-0 text-xs text-slate-300">Asteroid: {operation.asteroidId}</p>
      ) : null}
      <p className="m-0 text-xs text-slate-300">
        Cargo: {displayCargo}/{operation.cargoCapacity}
      </p>

      {operation.status === 'flying_to_destination' || operation.status === 'returning' ? (
        <>
          <ProgressBar progress={progress} colorClassName="bg-sky-400" />
          <p className="m-0 text-xs text-slate-300">
            Estimated remaining units: {operation.estimatedAsteroidRemainingUnits ?? 'n/a'}
          </p>
        </>
      ) : null}

      {operation.status === 'mining' ? (
        <>
          <ProgressBar progress={progress} colorClassName="bg-blue-500" />
          <p className="m-0 text-xs text-slate-300">Remaining units: {miningRemaining ?? 'n/a'}</p>
        </>
      ) : null}

      <button
        type="button"
        disabled={isActionPending || !canRecall}
        className="rounded-md border border-slate-300/35 bg-slate-800/75 px-3 py-1 text-sm text-slate-100 transition hover:bg-slate-700/80 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => {
          onRecall(operation.id)
        }}
      >
        Recall
      </button>
    </li>
  )
}

export function statusLabel(status: ActiveMiningOperationRow['status']): string {
  if (status === 'flying_to_destination') {
    return 'Flying toward destination'
  }

  if (status === 'mining') {
    return 'Mining'
  }

  return 'Returning'
}

export function operationProgress(operation: ActiveMiningOperationRow, nowMs: number): number {
  const phaseStartedAtMs = Date.parse(operation.phaseStartedAt)
  const phaseFinishAtMs = operation.phaseFinishAt ? Date.parse(operation.phaseFinishAt) : Number.NaN
  if (!Number.isFinite(phaseStartedAtMs) || !Number.isFinite(phaseFinishAtMs)) {
    return 0
  }

  const totalDuration = Math.max(1, phaseFinishAtMs - phaseStartedAtMs)
  const elapsed = Math.max(0, nowMs - phaseStartedAtMs)
  return Math.max(0, Math.min(1, elapsed / totalDuration))
}

export function liveMiningRemaining(
  operation: ActiveMiningOperationRow,
  progress: number,
): number | null {
  if (operation.status !== 'mining') {
    return null
  }

  if (operation.asteroidRemainingUnitsAtMiningStart === null) {
    return null
  }

  const consumed = Math.floor(operation.quantityTarget * progress)
  return Math.max(0, operation.asteroidRemainingUnitsAtMiningStart - consumed)
}

export function liveCargoAmount(operation: ActiveMiningOperationRow, progress: number): number {
  if (operation.status !== 'mining') {
    return operation.quantity
  }

  const remainingDelta = Math.max(0, operation.quantityTarget - operation.quantity)
  const interpolated = operation.quantity + Math.floor(remainingDelta * progress)
  return Math.max(operation.quantity, Math.min(operation.quantityTarget, interpolated))
}

function ProgressBar(props: { progress: number; colorClassName: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
      <div
        className={`h-full ${props.colorClassName}`}
        style={{ width: `${Math.round(Math.max(0, Math.min(1, props.progress)) * 100)}%` }}
      />
    </div>
  )
}
