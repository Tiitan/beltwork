import type { MapElement } from '../../../../types/app'
import { resolveRendererForElement } from './entityRenderers'

type AbstractPanelProps = {
  selectedElement: MapElement | null
  onClose: () => void
}

export function AbstractPanel({ selectedElement, onClose }: AbstractPanelProps) {
  const isOpen = selectedElement !== null
  const context = {
    onClose,
  }
  const renderer = selectedElement ? resolveRendererForElement(selectedElement) : null

  return (
    <aside
      className={`absolute inset-y-0 right-0 z-30 w-[min(92vw,380px)] border-l border-slate-300/20 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      onClick={(event) => event.stopPropagation()}
    >
      {renderer && selectedElement
        ? renderer.renderPanel({ data: selectedElement.data, context })
        : null}
    </aside>
  )
}
