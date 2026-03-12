import { MiningOperationCard } from '../../../components/mining/MiningOperationCard'
import type { StationPanelProps } from './types'
import { BuildingPanelShell } from './BuildingPanelShell'

type MiningDocksPanelData = {
  buildingId: string
  slotIndex: number
  level: number
  status: 'idle' | 'upgrading'
}

export function MiningDocksPanel({ data, context }: StationPanelProps<MiningDocksPanelData>) {
  const activeCount = context.activeMiningOperations.length

  return (
    <BuildingPanelShell
      title="Mining Docks"
      placeholder={`Active rigs: ${activeCount}/${context.miningRigCapacity}`}
      data={data}
      context={context}
      showGoToMap
    >
      <div className="grid gap-2 rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-100">
        <p className="m-0 text-slate-200">Mining Rigs</p>
        {context.activeMiningOperations.length === 0 ? (
          <p className="m-0 text-slate-300">No active mining operations.</p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {context.activeMiningOperations.map((operation) => (
              <MiningOperationCard
                key={operation.id}
                operation={operation}
                uiNowMs={context.uiNowMs}
                isActionPending={context.isActionPending}
                onRecall={(operationId) => {
                  void context.onRecallMiningOperation(operationId)
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </BuildingPanelShell>
  )
}
