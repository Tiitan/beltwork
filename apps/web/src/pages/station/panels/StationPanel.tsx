import { resolveRendererForStationEntity } from './entityRenderers'
import type { StationPanelContext, StationSlotEntity } from './types'
import { toStationRendererData } from './toStationRendererData'

type StationPanelProps = {
  selectedEntity: StationSlotEntity | null
  context: StationPanelContext
}

export function StationPanel({ selectedEntity, context }: StationPanelProps) {
  const isOpen = selectedEntity !== null
  const renderer = selectedEntity ? resolveRendererForStationEntity(selectedEntity) : null

  return (
    <aside
      className={`absolute inset-y-0 right-0 z-30 w-[min(92vw,380px)] border-l border-slate-300/20 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      onClick={(event) => event.stopPropagation()}
    >
      {renderer && selectedEntity
        ? renderer.renderPanel({ data: toStationRendererData(selectedEntity), context })
        : null}
    </aside>
  )
}
