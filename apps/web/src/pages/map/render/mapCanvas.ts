import type { MapElement, MapElementRef } from '../../../types/app'
import { loadImage } from '../../render/loadImage'
import type { MapEntityRenderer } from '../panels/types'

const MAP_EDGE_MARGIN_PX = 32

export type CameraState = {
  scale: number
  offsetX: number
  offsetY: number
}

export type WorldBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function clampMapCameraOffset(
  offsetX: number,
  offsetY: number,
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
  worldBounds: WorldBounds,
) {
  const worldLeft = worldBounds.minX * scale
  const worldRight = worldBounds.maxX * scale
  const worldTop = worldBounds.minY * scale
  const worldBottom = worldBounds.maxY * scale

  const worldWidth = worldRight - worldLeft
  const worldHeight = worldBottom - worldTop
  const paddedWorldWidth = worldWidth + MAP_EDGE_MARGIN_PX * 2
  const paddedWorldHeight = worldHeight + MAP_EDGE_MARGIN_PX * 2

  const centeredOffsetX = (viewportWidth - (worldLeft + worldRight)) / 2
  const centeredOffsetY = (viewportHeight - (worldTop + worldBottom)) / 2

  const minOffsetX = viewportWidth - MAP_EDGE_MARGIN_PX - worldRight
  const maxOffsetX = MAP_EDGE_MARGIN_PX - worldLeft
  const minOffsetY = viewportHeight - MAP_EDGE_MARGIN_PX - worldBottom
  const maxOffsetY = MAP_EDGE_MARGIN_PX - worldTop

  return {
    x:
      paddedWorldWidth <= viewportWidth
        ? centeredOffsetX
        : Math.min(maxOffsetX, Math.max(minOffsetX, offsetX)),
    y:
      paddedWorldHeight <= viewportHeight
        ? centeredOffsetY
        : Math.min(maxOffsetY, Math.max(minOffsetY, offsetY)),
  }
}

export function drawBackgroundAndWorldBorder(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: CameraState,
  worldBounds: WorldBounds,
) {
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#050915'
  context.fillRect(0, 0, width, height)

  context.strokeStyle = 'rgba(125, 149, 179, 0.16)'
  context.lineWidth = 1
  context.strokeRect(
    worldBounds.minX * camera.scale + camera.offsetX,
    worldBounds.minY * camera.scale + camera.offsetY,
    (worldBounds.maxX - worldBounds.minX) * camera.scale,
    (worldBounds.maxY - worldBounds.minY) * camera.scale,
  )
}

export function drawIconOrFallback(
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

export function drawEntity(
  context: CanvasRenderingContext2D,
  element: MapElement,
  renderer: MapEntityRenderer<any>,
  camera: CameraState,
  imageCache: Map<string, HTMLImageElement>,
  onImageReady: () => void,
  selectedRef: MapElementRef | null,
) {
  const coordinates = renderer.getCoordinates(element.data)
  const iconSize = renderer.getIconSize(element.data)
  const iconPath = renderer.getIconPath(element.data)
  const fallbackColor = renderer.getFallbackColor(element.data)
  const icon = loadImage(iconPath, imageCache, onImageReady)

  const x = coordinates.x * camera.scale + camera.offsetX
  const y = coordinates.y * camera.scale + camera.offsetY
  drawIconOrFallback(context, icon, x, y, iconSize, fallbackColor)

  if (selectedRef && selectedRef.type === element.type && selectedRef.id === element.data.id) {
    const selectionStyle = renderer.getSelectionStyle(element.data)
    context.strokeStyle = selectionStyle.strokeStyle
    context.lineWidth = selectionStyle.lineWidth
    context.beginPath()
    context.arc(x, y, iconSize * selectionStyle.radiusScale, 0, Math.PI * 2)
    context.stroke()
  }
}

export function findNearestEntityHit(
  worldX: number,
  worldY: number,
  entities: MapElement[],
  scale: number,
  resolveRenderer: (element: MapElement) => MapEntityRenderer<any>,
): MapElementRef | null {
  const candidates: Array<{ item: MapElementRef; distanceSquared: number }> = []

  for (const element of entities) {
    const renderer = resolveRenderer(element)
    const coordinates = renderer.getCoordinates(element.data)
    const hitRadius = renderer.getHitRadius(element.data, scale)
    const dx = coordinates.x - worldX
    const dy = coordinates.y - worldY
    const distanceSquared = dx * dx + dy * dy

    if (distanceSquared <= hitRadius * hitRadius) {
      candidates.push({
        item: { type: element.type, id: element.data.id },
        distanceSquared,
      })
    }
  }

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((a, b) => a.distanceSquared - b.distanceSquared)
  return candidates[0].item
}
