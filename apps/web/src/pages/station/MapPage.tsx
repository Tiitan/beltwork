import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { useStation } from '../../features/station/useStation'
import type { MapElement, MapElementRef } from '../../types/app'
import { AbstractPanel } from './map/panels/AbstractPanel'
import { resolveRendererForElement } from './map/panels/entityRenderers'
import {
  drawBackgroundAndAxes,
  drawEntity,
  findNearestEntityHit,
  type CameraState,
} from './map/render/mapCanvas'

const MIN_SCALE = 0.1
const MAX_SCALE = 4
const DRAG_THRESHOLD_PX = 4

export function MapPage() {
  const {
    mapEntities,
    mapError,
    isMapLoading,
    playerAnchor,
    selectedElement,
    selectedElementRef,
    setSelectedElementRef,
    clearSelectedElement,
  } = useStation()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 })
  const didDragRef = useRef(false)
  const hasInitializedViewRef = useRef(false)

  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [hoveredElementRef, setHoveredElementRef] = useState<MapElementRef | null>(null)
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null)
  const [imageVersion, setImageVersion] = useState(0)

  const hoveredElement = useMemo<MapElement | null>(() => {
    if (!hoveredElementRef) {
      return null
    }

    return (
      mapEntities.find(
        (entity) =>
          entity.type === hoveredElementRef.type && entity.data.id === hoveredElementRef.id,
      ) ?? null
    )
  }, [hoveredElementRef, mapEntities])

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    const measure = () => {
      const rect = element.getBoundingClientRect()
      setCanvasSize({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      })
    }

    measure()
    const observer = new ResizeObserver(measure)

    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!canvasSize || !playerAnchor || hasInitializedViewRef.current) {
      return
    }

    const initialScale = 1
    setScale(initialScale)
    setOffset({
      x: canvasSize.width / 2 - playerAnchor.x * initialScale,
      y: canvasSize.height / 2 - playerAnchor.y * initialScale,
    })
    hasInitializedViewRef.current = true
  }, [canvasSize, playerAnchor])

  useEffect(() => {
    if (!canvasSize) {
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    canvas.width = canvasSize.width
    canvas.height = canvasSize.height
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    const camera: CameraState = {
      scale,
      offsetX: offset.x,
      offsetY: offset.y,
    }

    drawBackgroundAndAxes(context, canvas.width, canvas.height, camera)

    for (const entity of mapEntities) {
      const renderer = resolveRendererForElement(entity)
      drawEntity(
        context,
        entity,
        renderer,
        camera,
        imageCacheRef.current,
        () => {
          setImageVersion((previous) => previous + 1)
        },
        selectedElementRef,
      )
    }
  }, [canvasSize, imageVersion, mapEntities, offset, scale, selectedElementRef])

  function toWorldCoordinates(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return null
    }

    const screenX = clientX - rect.left
    const screenY = clientY - rect.top
    return {
      x: (screenX - offset.x) / scale,
      y: (screenY - offset.y) / scale,
      screenX,
      screenY,
    }
  }

  function findNearestHit(worldX: number, worldY: number): MapElementRef | null {
    return findNearestEntityHit(worldX, worldY, mapEntities, scale, resolveRendererForElement)
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    }
    didDragRef.current = false
    setIsDragging(true)
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const world = toWorldCoordinates(event.clientX, event.clientY)
    if (world) {
      setHoverPosition({ x: world.screenX, y: world.screenY })
      setHoveredElementRef(findNearestHit(world.x, world.y))
    }

    if (!isDragging) {
      return
    }

    const deltaX = event.clientX - dragStartRef.current.x
    const deltaY = event.clientY - dragStartRef.current.y
    if (!didDragRef.current && Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD_PX) {
      didDragRef.current = true
    }

    setOffset({
      x: dragStartRef.current.offsetX + deltaX,
      y: dragStartRef.current.offsetY + deltaY,
    })
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const world = toWorldCoordinates(event.clientX, event.clientY)
    const didDrag = didDragRef.current
    setIsDragging(false)
    didDragRef.current = false

    if (!world || didDrag) {
      return
    }

    const hit = findNearestHit(world.x, world.y)
    if (!hit) {
      clearSelectedElement()
      return
    }

    setSelectedElementRef(hit)
  }

  function handleWheel(event: WheelEvent<HTMLCanvasElement>) {
    event.preventDefault()
    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, scale * (event.deltaY > 0 ? 0.9 : 1.1)),
    )
    const pointer = toWorldCoordinates(event.clientX, event.clientY)
    if (!pointer) {
      setScale(nextScale)
      return
    }

    setOffset({
      x: pointer.screenX - pointer.x * nextScale,
      y: pointer.screenY - pointer.y * nextScale,
    })
    setScale(nextScale)
  }

  const tooltipStyle =
    canvasSize && hoverPosition
      ? {
          left: Math.min(Math.max(10, hoverPosition.x + 12), Math.max(10, canvasSize.width - 230)),
          top: Math.min(Math.max(10, hoverPosition.y + 12), Math.max(10, canvasSize.height - 72)),
        }
      : undefined

  const selectedLabel = selectedElement
    ? resolveRendererForElement(selectedElement).getLabel(selectedElement.data)
    : null

  return (
    <section
      aria-label="Map page canvas"
      className="fixed inset-y-0 left-0 right-0 z-10 overflow-hidden bg-slate-950 lg:left-72"
    >
      <div ref={containerRef} className="relative h-full w-full overflow-hidden">
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
          <span className="rounded-md bg-slate-900/75 px-2 py-1 text-xs text-slate-200">
            Entities: {mapEntities.length}
          </span>
          <span className="rounded-md bg-slate-900/75 px-2 py-1 text-xs text-slate-200">
            Zoom: {(scale * 100).toFixed(0)}%
          </span>
          {isMapLoading ? (
            <span className="rounded-md bg-slate-900/75 px-2 py-1 text-xs text-slate-200">
              Loading map...
            </span>
          ) : null}
          {mapError ? (
            <span className="rounded-md bg-red-900/70 px-2 py-1 text-xs text-red-100">
              Map unavailable.
            </span>
          ) : null}
          {selectedLabel ? (
            <span className="rounded-md bg-slate-900/75 px-2 py-1 text-xs text-slate-200">
              Selected: {selectedLabel}
            </span>
          ) : null}
        </div>

        {hoveredElement && hoverPosition && !selectedElementRef ? (
          <div
            className="pointer-events-none absolute z-20 rounded-md bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-lg"
            style={tooltipStyle}
          >
            {resolveRendererForElement(hoveredElement).renderTooltip(hoveredElement.data)}
          </div>
        ) : null}

        {canvasSize ? (
          <canvas
            ref={canvasRef}
            className="block h-full w-full touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              setHoveredElementRef(null)
              setHoverPosition(null)
            }}
            onPointerCancel={() => setIsDragging(false)}
            onWheel={handleWheel}
          />
        ) : (
          <div className="h-full w-full" />
        )}

        {selectedElementRef ? (
          <button
            type="button"
            aria-label="Close details panel"
            className="absolute inset-0 z-20 bg-slate-950/45"
            onClick={clearSelectedElement}
          />
        ) : null}

        <AbstractPanel selectedElement={selectedElement} onClose={clearSelectedElement} />
      </div>
    </section>
  )
}
