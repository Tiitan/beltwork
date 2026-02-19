import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import {
  getAsteroidIconPath,
  getDefaultAsteroidIconPath,
  getStationIconPath,
  iconFallbackPaths,
} from '../../features/station/iconPaths'
import { scanAsteroid } from '../../features/station/api'
import { useStation } from '../../features/station/useStation'
import type { MapSelection } from '../../types/app'

const MIN_SCALE = 0.1
const MAX_SCALE = 4
const ASTEROID_ICON_SIZE = 36
const STATION_ICON_SIZE = 44
const DRAG_THRESHOLD_PX = 4

export function MapPage() {
  const {
    mapSnapshot,
    mapError,
    isMapLoading,
    playerStation,
    selectedMapItem,
    selectedStation,
    selectedAsteroid,
    setSelectedMapItem,
    clearSelectedMapItem,
    refreshMapSnapshot,
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
  const [hoveredItem, setHoveredItem] = useState<MapSelection | null>(null)
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [imageVersion, setImageVersion] = useState(0)

  const hoveredStation = useMemo(
    () =>
      hoveredItem?.type === 'station'
        ? (mapSnapshot.stations.find((station) => station.id === hoveredItem.id) ?? null)
        : null,
    [hoveredItem, mapSnapshot.stations],
  )

  const hoveredAsteroid = useMemo(
    () =>
      hoveredItem?.type === 'asteroid'
        ? (mapSnapshot.asteroids.find((asteroid) => asteroid.id === hoveredItem.id) ?? null)
        : null,
    [hoveredItem, mapSnapshot.asteroids],
  )

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
    if (!canvasSize || !playerStation || hasInitializedViewRef.current) {
      return
    }

    const initialScale = 1
    setScale(initialScale)
    setOffset({
      x: canvasSize.width / 2 - playerStation.x * initialScale,
      y: canvasSize.height / 2 - playerStation.y * initialScale,
    })
    hasInitializedViewRef.current = true
  }, [canvasSize, playerStation])

  useEffect(() => {
    setActionMessage(null)
  }, [selectedMapItem])

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

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#050915'
    context.fillRect(0, 0, canvas.width, canvas.height)

    context.strokeStyle = 'rgba(125, 149, 179, 0.16)'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(0, offset.y)
    context.lineTo(canvas.width, offset.y)
    context.moveTo(offset.x, 0)
    context.lineTo(offset.x, canvas.height)
    context.stroke()

    const stationIcon = loadImage(getStationIconPath(), imageCacheRef.current, () => {
      setImageVersion((previous) => previous + 1)
    })
    for (const station of mapSnapshot.stations) {
      const x = station.x * scale + offset.x
      const y = station.y * scale + offset.y
      drawIconOrFallback(context, stationIcon, x, y, STATION_ICON_SIZE, '#6ee7f9')

      if (selectedMapItem?.type === 'station' && selectedMapItem.id === station.id) {
        context.strokeStyle = '#38bdf8'
        context.lineWidth = 2
        context.beginPath()
        context.arc(x, y, STATION_ICON_SIZE * 0.72, 0, Math.PI * 2)
        context.stroke()
      }
    }

    for (const asteroid of mapSnapshot.asteroids) {
      const iconPath =
        asteroid.isScanned && asteroid.templateId
          ? getAsteroidIconPath(`ast_${asteroid.templateId}`)
          : getDefaultAsteroidIconPath()
      const asteroidIcon = loadImage(iconPath, imageCacheRef.current, () => {
        setImageVersion((previous) => previous + 1)
      })
      const x = asteroid.x * scale + offset.x
      const y = asteroid.y * scale + offset.y
      drawIconOrFallback(context, asteroidIcon, x, y, ASTEROID_ICON_SIZE, '#fbbf24')

      if (selectedMapItem?.type === 'asteroid' && selectedMapItem.id === asteroid.id) {
        context.strokeStyle = '#34d399'
        context.lineWidth = 2
        context.beginPath()
        context.arc(x, y, ASTEROID_ICON_SIZE * 0.7, 0, Math.PI * 2)
        context.stroke()
      }
    }
  }, [canvasSize, imageVersion, mapSnapshot, offset, scale, selectedMapItem])

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

  function findNearestHit(worldX: number, worldY: number): MapSelection | null {
    const candidates: Array<{ item: MapSelection; distanceSquared: number }> = []

    const asteroidRadius = (ASTEROID_ICON_SIZE * 0.5) / scale
    const stationRadius = (STATION_ICON_SIZE * 0.5) / scale

    for (const asteroid of mapSnapshot.asteroids) {
      const dx = asteroid.x - worldX
      const dy = asteroid.y - worldY
      const distanceSquared = dx * dx + dy * dy
      if (distanceSquared <= asteroidRadius * asteroidRadius) {
        candidates.push({ item: { type: 'asteroid', id: asteroid.id }, distanceSquared })
      }
    }

    for (const station of mapSnapshot.stations) {
      const dx = station.x - worldX
      const dy = station.y - worldY
      const distanceSquared = dx * dx + dy * dy
      if (distanceSquared <= stationRadius * stationRadius) {
        candidates.push({ item: { type: 'station', id: station.id }, distanceSquared })
      }
    }

    if (candidates.length === 0) {
      return null
    }

    candidates.sort((a, b) => a.distanceSquared - b.distanceSquared)
    return candidates[0].item
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
      setHoveredItem(findNearestHit(world.x, world.y))
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
      clearSelectedMapItem()
      return
    }

    setSelectedMapItem(hit)
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

  async function handleAsteroidAction(action: 'scan' | 'deploy') {
    if (!selectedAsteroid) {
      return
    }

    if (action === 'scan') {
      try {
        await scanAsteroid(selectedAsteroid.id)
        await refreshMapSnapshot()
        setActionMessage(`Scan completed for asteroid ${selectedAsteroid.id}.`)
      } catch {
        setActionMessage(`Scan failed for asteroid ${selectedAsteroid.id}.`)
      }
      return
    }

    const message = `Deploy mining rig not implemented yet for asteroid ${selectedAsteroid.id}.`
    setActionMessage(message)
    console.info(message)
  }

  const tooltipLabel = hoveredStation
    ? hoveredStation.name
    : hoveredAsteroid
      ? hoveredAsteroid.isScanned
        ? (hoveredAsteroid.name ?? 'Unknown Asteroid')
        : 'Unknown Asteroid'
      : null

  const tooltipCoordinates = hoveredStation
    ? formatCoordinates(hoveredStation.x, hoveredStation.y)
    : hoveredAsteroid
      ? formatCoordinates(hoveredAsteroid.x, hoveredAsteroid.y)
      : null

  const tooltipStyle =
    canvasSize && hoverPosition
      ? {
          left: Math.min(Math.max(10, hoverPosition.x + 12), Math.max(10, canvasSize.width - 230)),
          top: Math.min(Math.max(10, hoverPosition.y + 12), Math.max(10, canvasSize.height - 72)),
        }
      : undefined

  return (
    <section
      aria-label="Map page canvas"
      className="fixed inset-y-0 left-0 right-0 z-10 overflow-hidden bg-slate-950 lg:left-72"
    >
      <div ref={containerRef} className="relative h-full w-full overflow-hidden">
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
          <span className="rounded-md bg-slate-900/75 px-2 py-1 text-xs text-slate-200">
            Stations: {mapSnapshot.stations.length}
          </span>
          <span className="rounded-md bg-slate-900/75 px-2 py-1 text-xs text-slate-200">
            Asteroids: {mapSnapshot.asteroids.length}
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
        </div>

        {tooltipLabel && tooltipCoordinates && hoverPosition && !selectedMapItem ? (
          <div
            className="pointer-events-none absolute z-20 rounded-md bg-slate-900/90 px-3 py-2 text-xs text-slate-100 shadow-lg"
            style={tooltipStyle}
          >
            <p className="font-semibold text-sky-100">{tooltipLabel}</p>
            <p>{tooltipCoordinates}</p>
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
              setHoveredItem(null)
              setHoverPosition(null)
            }}
            onPointerCancel={() => setIsDragging(false)}
            onWheel={handleWheel}
          />
        ) : (
          <div className="h-full w-full" />
        )}

        {selectedMapItem ? (
          <button
            type="button"
            aria-label="Close details panel"
            className="absolute inset-0 z-20 bg-slate-950/45"
            onClick={clearSelectedMapItem}
          />
        ) : null}

        <aside
          className={`absolute inset-y-0 right-0 z-30 w-[min(92vw,380px)] border-l border-slate-300/20 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out ${selectedMapItem ? 'translate-x-0' : 'translate-x-full'}`}
          onClick={(event) => event.stopPropagation()}
        >
          {selectedStation ? (
            <div className="grid gap-3">
              <h3 className="text-lg text-sky-100">Station</h3>
              <div className="rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-200">
                <p className="font-semibold text-sky-100">{selectedStation.name}</p>
                <p>{formatCoordinates(selectedStation.x, selectedStation.y)}</p>
              </div>
            </div>
          ) : null}

          {selectedAsteroid ? (
            <div className="grid gap-3">
              <h3 className="text-lg text-sky-100">Asteroid</h3>
              <div className="rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-200">
                <p className="font-semibold text-sky-100">
                  {selectedAsteroid.isScanned
                    ? (selectedAsteroid.name ?? 'Unknown Asteroid')
                    : 'Unknown Asteroid'}
                </p>
                <p>{formatCoordinates(selectedAsteroid.x, selectedAsteroid.y)}</p>
              </div>

              {selectedAsteroid.isScanned ? (
                <div className="rounded-md border border-emerald-400/30 bg-emerald-950/25 p-3 text-sm text-emerald-100">
                  <p>Yield multiplier: {selectedAsteroid.yieldMultiplier ?? 'n/a'}</p>
                  <p>Remaining units (scan): {selectedAsteroid.scannedRemainingUnits ?? 'n/a'}</p>
                  <p>Scanned at: {formatTimestamp(selectedAsteroid.scannedAt)}</p>
                </div>
              ) : (
                <div className="rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-300">
                  <p>Yield multiplier: Unknown (scan required)</p>
                  <p>Remaining units: Unknown (scan required)</p>
                  <p>Resources: Unknown (scan required)</p>
                </div>
              )}

              {selectedAsteroid.isScanned ? (
                <div className="rounded-md border border-slate-400/30 bg-slate-900/55 p-3 text-sm text-slate-200">
                  <p className="mb-2 font-semibold text-sky-100">Resources</p>
                  {renderComposition(selectedAsteroid.composition)}
                </div>
              ) : null}

              <div className="grid gap-2 rounded-md border border-slate-400/30 bg-slate-900/55 p-3">
                <p className="text-sm font-semibold text-sky-100">Actions</p>
                <button
                  type="button"
                  className="rounded-md border border-slate-300/35 bg-slate-800/75 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-700/80"
                  onClick={() => {
                    void handleAsteroidAction('scan')
                  }}
                >
                  Scan
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300/35 bg-slate-800/75 px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-slate-700/80"
                  onClick={() => {
                    void handleAsteroidAction('deploy')
                  }}
                >
                  Deploy mining rig
                </button>
                {actionMessage ? <p className="text-xs text-amber-200">{actionMessage}</p> : null}
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <img src={iconFallbackPaths.asteroid} alt="" className="hidden" />
      <img src={iconFallbackPaths.station} alt="" className="hidden" />
    </section>
  )
}

function formatCoordinates(x: number, y: number) {
  return `X: ${Math.round(x)} | Y: ${Math.round(y)}`
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

function loadImage(path: string, cache: Map<string, HTMLImageElement>, onReady: () => void) {
  const existing = cache.get(path)
  if (existing) {
    return existing
  }

  const image = new Image()
  image.onload = onReady
  image.onerror = onReady
  image.src = path
  cache.set(path, image)
  return image
}

function drawIconOrFallback(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number,
  fallbackColor: string,
) {
  if (image.complete && image.naturalWidth > 0) {
    context.drawImage(image, x - size / 2, y - size / 2, size, size)
    return
  }

  context.fillStyle = fallbackColor
  context.beginPath()
  context.arc(x, y, size / 3, 0, Math.PI * 2)
  context.fill()
}
