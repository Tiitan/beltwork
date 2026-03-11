import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStation } from '../../features/station/useStation'
import { resolveRendererForStationEntity } from './panels/entityRenderers'
import { StationPanel } from './panels/StationPanel'
import type { StationSlotEntity } from './panels/types'
import { toStationRendererData } from './panels/toStationRendererData'
import { loadImage } from '../render/loadImage'
import {
  clampCameraOffset,
  drawStationScene,
  findNearestStationSlotHit,
} from './render/stationScene'
import { stationImageSize, stationSlotLayout } from './slotLayout'

const DRAG_THRESHOLD_MOUSE_PX = 4
const DRAG_THRESHOLD_TOUCH_PX = 12
const MIN_SCALE_FACTOR = 0.7
const MAX_SCALE_FACTOR = 3
const STATION_BACKGROUND_PATH = '/assets/page/station_map.png'
const UPGRADE_PROGRESS_TICK_MS = 250

export function StationHomePage() {
  const navigate = useNavigate()
  const {
    inventory,
    buildings,
    buildableBuildings,
    buildBuildingInSlot,
    upgradeBuildingById,
    inventoryError,
    isStationActionPending,
  } = useStation()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const hasInitializedViewRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 })
  const didDragRef = useRef(false)
  const dragThresholdRef = useRef(DRAG_THRESHOLD_MOUSE_PX)
  const suppressNextSelectionRef = useRef(false)

  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [imageVersion, setImageVersion] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null)
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [sceneNowMs, setSceneNowMs] = useState(() => Date.now())

  const hasUpgradingBuildings = useMemo(
    () => buildings.some((building) => building.status === 'upgrading'),
    [buildings],
  )

  const stationEntities = useMemo<StationSlotEntity[]>(() => {
    const buildingBySlotIndex = new Map(buildings.map((building) => [building.slotIndex, building]))
    return stationSlotLayout.map((slot) => {
      const building = buildingBySlotIndex.get(slot.slotIndex)
      if (!building) {
        return {
          kind: 'empty_slot',
          slot,
        }
      }

      return {
        kind: 'building_slot',
        slot,
        building,
      }
    })
  }, [buildings])

  const selectedEntity = useMemo(() => {
    if (selectedSlotIndex === null) {
      return null
    }
    return stationEntities.find((entity) => entity.slot.slotIndex === selectedSlotIndex) ?? null
  }, [selectedSlotIndex, stationEntities])

  const hoveredEntity = useMemo(() => {
    if (hoveredSlotIndex === null) {
      return null
    }
    return stationEntities.find((entity) => entity.slot.slotIndex === hoveredSlotIndex) ?? null
  }, [hoveredSlotIndex, stationEntities])

  const selectedLabel = selectedEntity
    ? resolveRendererForStationEntity(selectedEntity).getLabel(
        toStationRendererData(selectedEntity),
      )
    : null

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
    return () => observer.disconnect()
  }, [])

  const minimumScale = useMemo(() => {
    if (!canvasSize) {
      return 0.5
    }
    const baseCoverScale = Math.max(
      canvasSize.width / stationImageSize.width,
      canvasSize.height / stationImageSize.height,
    )
    return baseCoverScale * MIN_SCALE_FACTOR
  }, [canvasSize])

  const maximumScale = useMemo(() => minimumScale * MAX_SCALE_FACTOR, [minimumScale])

  useEffect(() => {
    if (!canvasSize || hasInitializedViewRef.current) {
      return
    }

    const baseCoverScale = Math.max(
      canvasSize.width / stationImageSize.width,
      canvasSize.height / stationImageSize.height,
    )
    const centeredOffset = clampCameraOffset(
      (canvasSize.width - stationImageSize.width * baseCoverScale) / 2,
      (canvasSize.height - stationImageSize.height * baseCoverScale) / 2,
      baseCoverScale,
      canvasSize.width,
      canvasSize.height,
    )

    setScale(baseCoverScale)
    setOffset(centeredOffset)
    hasInitializedViewRef.current = true
  }, [canvasSize])

  useEffect(() => {
    if (!canvasSize || !hasInitializedViewRef.current) {
      return
    }

    setOffset((previous) =>
      clampCameraOffset(previous.x, previous.y, scale, canvasSize.width, canvasSize.height),
    )
  }, [canvasSize, scale])

  useEffect(() => {
    setSceneNowMs(Date.now())
    if (!hasUpgradingBuildings) {
      return
    }

    const timer = setInterval(() => {
      setSceneNowMs(Date.now())
    }, UPGRADE_PROGRESS_TICK_MS)

    return () => {
      clearInterval(timer)
    }
  }, [hasUpgradingBuildings])

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

    const background = loadImage(STATION_BACKGROUND_PATH, imageCacheRef.current, () => {
      setImageVersion((previous) => previous + 1)
    })

    if (!background.complete || background.naturalWidth <= 0) {
      context.clearRect(0, 0, canvasSize.width, canvasSize.height)
      context.fillStyle = '#030712'
      context.fillRect(0, 0, canvasSize.width, canvasSize.height)
      return
    }

    drawStationScene(
      context,
      canvasSize.width,
      canvasSize.height,
      {
        scale,
        offsetX: offset.x,
        offsetY: offset.y,
      },
      background,
      stationEntities,
      selectedSlotIndex,
      hoveredSlotIndex,
      imageCacheRef.current,
      () => {
        setImageVersion((previous) => previous + 1)
      },
      sceneNowMs,
    )
  }, [
    canvasSize,
    hoveredSlotIndex,
    imageVersion,
    offset.x,
    offset.y,
    scale,
    sceneNowMs,
    selectedSlotIndex,
    stationEntities,
  ])

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

  function findNearestHit(worldX: number, worldY: number) {
    return findNearestStationSlotHit(worldX, worldY, stationEntities, scale)
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    dragThresholdRef.current =
      event.pointerType === 'touch' ? DRAG_THRESHOLD_TOUCH_PX : DRAG_THRESHOLD_MOUSE_PX
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
      setHoveredSlotIndex(findNearestHit(world.x, world.y))
    }

    if (!isDragging || !canvasSize) {
      return
    }

    const deltaX = event.clientX - dragStartRef.current.x
    const deltaY = event.clientY - dragStartRef.current.y
    if (!didDragRef.current && Math.hypot(deltaX, deltaY) > dragThresholdRef.current) {
      didDragRef.current = true
    }

    const nextOffset = clampCameraOffset(
      dragStartRef.current.offsetX + deltaX,
      dragStartRef.current.offsetY + deltaY,
      scale,
      canvasSize.width,
      canvasSize.height,
    )
    setOffset(nextOffset)
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const world = toWorldCoordinates(event.clientX, event.clientY)
    const didDrag = didDragRef.current
    setIsDragging(false)
    didDragRef.current = false

    if (suppressNextSelectionRef.current) {
      suppressNextSelectionRef.current = false
      return
    }

    if (!world || didDrag) {
      return
    }

    const hit = findNearestHit(world.x, world.y)
    setSelectedSlotIndex(hit)
    setActionError(null)
  }

  function handleWheel(event: WheelEvent<HTMLCanvasElement>) {
    if (!canvasSize) {
      return
    }

    event.preventDefault()
    const pointer = toWorldCoordinates(event.clientX, event.clientY)
    const nextScale = Math.min(
      maximumScale,
      Math.max(minimumScale, scale * (event.deltaY > 0 ? 0.9 : 1.1)),
    )

    if (!pointer) {
      setScale(nextScale)
      return
    }

    const unclampedOffsetX = pointer.screenX - pointer.x * nextScale
    const unclampedOffsetY = pointer.screenY - pointer.y * nextScale
    const nextOffset = clampCameraOffset(
      unclampedOffsetX,
      unclampedOffsetY,
      nextScale,
      canvasSize.width,
      canvasSize.height,
    )

    setScale(nextScale)
    setOffset(nextOffset)
  }

  async function handleBuildBuilding(slotIndex: number, buildingType: string) {
    try {
      setActionError(null)
      await buildBuildingInSlot(slotIndex, buildingType)
      setSelectedSlotIndex(slotIndex)
    } catch {
      setActionError('Build failed. Please try another slot.')
    }
  }

  async function handleUpgradeBuilding(buildingId: string) {
    try {
      setActionError(null)
      await upgradeBuildingById(buildingId)
    } catch {
      setActionError('Upgrade failed. Please try again.')
    }
  }

  const tooltipStyle =
    canvasSize && hoverPosition
      ? {
          left: Math.min(Math.max(10, hoverPosition.x + 12), Math.max(10, canvasSize.width - 230)),
          top: Math.min(Math.max(10, hoverPosition.y + 12), Math.max(10, canvasSize.height - 86)),
        }
      : undefined

  return (
    <section
      aria-label="Station page canvas"
      className="fixed inset-y-0 left-0 right-0 z-10 overflow-hidden bg-slate-950 lg:left-72"
    >
      <div ref={containerRef} className="relative h-full w-full overflow-hidden">
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
          <span className="rounded-md bg-slate-900/75 px-2 py-1 text-xs text-slate-200">
            Slots: {stationEntities.length}
          </span>
          <span className="rounded-md bg-slate-900/75 px-2 py-1 text-xs text-slate-200">
            Zoom: {(scale * 100).toFixed(0)}%
          </span>
          {selectedLabel ? (
            <span className="rounded-md bg-slate-900/75 px-2 py-1 text-xs text-slate-200">
              Selected: {selectedLabel}
            </span>
          ) : null}
          {inventoryError ? (
            <span className="rounded-md bg-red-900/70 px-2 py-1 text-xs text-red-100">
              Station unavailable.
            </span>
          ) : null}
          {actionError ? (
            <span className="rounded-md bg-red-900/70 px-2 py-1 text-xs text-red-100">
              {actionError}
            </span>
          ) : null}
        </div>

        {hoveredEntity && hoverPosition && selectedSlotIndex === null ? (
          <div
            className="pointer-events-none absolute z-20 rounded-md bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-lg"
            style={tooltipStyle}
          >
            {resolveRendererForStationEntity(hoveredEntity).getTooltip(
              toStationRendererData(hoveredEntity),
            )}
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
              setHoveredSlotIndex(null)
              setHoverPosition(null)
            }}
            onPointerCancel={() => {
              setIsDragging(false)
              didDragRef.current = false
            }}
            onWheel={handleWheel}
          />
        ) : (
          <div className="h-full w-full" />
        )}

        {selectedEntity ? (
          <button
            type="button"
            aria-label="Close details panel"
            className="absolute inset-0 z-20 bg-slate-950/45"
            onPointerDown={(event) => {
              event.preventDefault()
              suppressNextSelectionRef.current = true
              setSelectedSlotIndex(null)
            }}
            onClick={(event) => {
              if (event.detail === 0) {
                setSelectedSlotIndex(null)
              }
            }}
          />
        ) : null}

        <StationPanel
          selectedEntity={selectedEntity}
          context={{
            inventory,
            buildableBuildings,
            isActionPending: isStationActionPending,
            actionError,
            onBuildBuilding: handleBuildBuilding,
            onUpgradeBuilding: handleUpgradeBuilding,
            onGoToMap: () => navigate('/map'),
          }}
        />
      </div>
    </section>
  )
}
