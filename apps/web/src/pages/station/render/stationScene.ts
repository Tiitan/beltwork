import type { StationSlotEntity } from '../panels/types'
import { resolveRendererForStationEntity } from '../panels/entityRenderers'
import { toStationRendererData } from '../panels/toStationRendererData'
import { stationImageSize } from '../slotLayout'
import { getBuildingIconPath } from '../../../features/station/iconPaths'
import { loadImage } from '../../render/loadImage'

const EMPTY_PLATFORM_PATH = '/assets/icons/buildings/empty_platform.png'
const BUILDING_HIT_CENTER_OFFSET_Y_FACTOR = 0.3

export type StationCameraState = {
  scale: number
  offsetX: number
  offsetY: number
}

export function clampCameraOffset(
  offsetX: number,
  offsetY: number,
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const scaledImageWidth = stationImageSize.width * scale
  const scaledImageHeight = stationImageSize.height * scale

  const minOffsetX =
    scaledImageWidth > viewportWidth
      ? viewportWidth - scaledImageWidth
      : (viewportWidth - scaledImageWidth) / 2
  const maxOffsetX = scaledImageWidth > viewportWidth ? 0 : (viewportWidth - scaledImageWidth) / 2
  const minOffsetY =
    scaledImageHeight > viewportHeight
      ? viewportHeight - scaledImageHeight
      : (viewportHeight - scaledImageHeight) / 2
  const maxOffsetY =
    scaledImageHeight > viewportHeight ? 0 : (viewportHeight - scaledImageHeight) / 2

  return {
    x: Math.min(maxOffsetX, Math.max(minOffsetX, offsetX)),
    y: Math.min(maxOffsetY, Math.max(minOffsetY, offsetY)),
  }
}

export function drawStationScene(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: StationCameraState,
  background: HTMLImageElement,
  entities: StationSlotEntity[],
  selectedSlotIndex: number | null,
  hoveredSlotIndex: number | null,
  imageCache: Map<string, HTMLImageElement>,
  onImageReady: () => void,
) {
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#030712'
  context.fillRect(0, 0, width, height)

  context.drawImage(
    background,
    camera.offsetX,
    camera.offsetY,
    stationImageSize.width * camera.scale,
    stationImageSize.height * camera.scale,
  )

  for (const entity of entities) {
    drawSlotOverlay(
      context,
      entity,
      camera,
      selectedSlotIndex,
      hoveredSlotIndex,
      imageCache,
      onImageReady,
    )
  }
}

function resolveOverlayRect(
  slotX: number,
  slotY: number,
  slotWidth: number,
  slotHeight: number,
  image: HTMLImageElement | null,
) {
  if (!image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    return {
      x: slotX - slotWidth / 2,
      y: slotY - slotHeight / 2,
      width: slotWidth,
      height: slotHeight,
    }
  }

  const imageRatio = image.naturalWidth / image.naturalHeight
  if (!Number.isFinite(imageRatio) || imageRatio <= 0) {
    return {
      x: slotX - slotWidth / 2,
      y: slotY - slotHeight / 2,
      width: slotWidth,
      height: slotHeight,
    }
  }

  let width = slotWidth
  let height = width / imageRatio

  if (height > slotHeight) {
    height = slotHeight
    width = height * imageRatio
  }

  return {
    x: slotX - width / 2,
    y: slotY - height / 2,
    width,
    height,
  }
}

function scaleRectFromBottomCenter(
  rect: { x: number; y: number; width: number; height: number },
  anchorX: number,
  anchorBottomY: number,
  factor: number,
) {
  const width = rect.width * factor
  const height = rect.height * factor
  return {
    x: anchorX - width / 2,
    y: anchorBottomY - height,
    width,
    height,
  }
}

function drawSlotOverlay(
  context: CanvasRenderingContext2D,
  entity: StationSlotEntity,
  camera: StationCameraState,
  selectedSlotIndex: number | null,
  hoveredSlotIndex: number | null,
  imageCache: Map<string, HTMLImageElement>,
  onImageReady: () => void,
) {
  const { slot } = entity
  const slotX = slot.x * camera.scale + camera.offsetX
  const slotY = slot.y * camera.scale + camera.offsetY
  const slotWidth = slot.width * camera.scale
  const slotHeight = slot.height * camera.scale

  const isSelected = selectedSlotIndex === slot.slotIndex
  const isHovered = hoveredSlotIndex === slot.slotIndex
  const slotImage =
    entity.kind === 'building_slot'
      ? loadImage(getBuildingIconPath(entity.building.type), imageCache, onImageReady)
      : loadImage(EMPTY_PLATFORM_PATH, imageCache, onImageReady)
  const baseOverlayRect = resolveOverlayRect(slotX, slotY, slotWidth, slotHeight, slotImage)
  const overlayRect =
    entity.kind === 'building_slot'
      ? scaleRectFromBottomCenter(baseOverlayRect, slotX, slotY + slotHeight / 2, 1.8)
      : baseOverlayRect
  const overlayRadius = Math.max(
    10,
    Math.min(28, Math.min(overlayRect.width, overlayRect.height) * 0.14),
  )
  const isHighlighted = isSelected || isHovered

  if (slotImage && slotImage.complete && slotImage.naturalWidth > 0) {
    context.save()
    context.beginPath()
    context.roundRect(
      overlayRect.x,
      overlayRect.y,
      overlayRect.width,
      overlayRect.height,
      overlayRadius,
    )
    context.clip()

    if (isHighlighted) {
      context.filter = isSelected
        ? 'brightness(1.22) saturate(1.16)'
        : 'brightness(1.14) saturate(1.1)'
      context.shadowColor = isSelected ? 'rgba(56, 189, 248, 0.42)' : 'rgba(56, 189, 248, 0.3)'
      context.shadowBlur = isSelected ? 16 : 10
    }

    context.drawImage(
      slotImage,
      overlayRect.x,
      overlayRect.y,
      overlayRect.width,
      overlayRect.height,
    )
    context.restore()
  } else if (entity.kind === 'building_slot') {
    context.fillStyle = isHighlighted ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.92)'
    context.beginPath()
    context.roundRect(
      overlayRect.x,
      overlayRect.y,
      overlayRect.width,
      overlayRect.height,
      overlayRadius,
    )
    context.fill()

    context.fillStyle = 'rgba(226, 232, 240, 0.96)'
    context.font = `${Math.max(10, Math.round(18 * camera.scale))}px "Segoe UI"`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(
      'B',
      overlayRect.x + overlayRect.width / 2,
      overlayRect.y + overlayRect.height / 2,
    )
  } else {
    context.fillStyle = isHighlighted ? 'rgba(30, 41, 59, 0.55)' : 'rgba(15, 23, 42, 0.24)'
    context.beginPath()
    context.roundRect(
      overlayRect.x,
      overlayRect.y,
      overlayRect.width,
      overlayRect.height,
      overlayRadius,
    )
    context.fill()
  }
}

export function findNearestStationSlotHit(
  worldX: number,
  worldY: number,
  entities: StationSlotEntity[],
  scale: number,
): number | null {
  const candidates: Array<{ slotIndex: number; distanceSquared: number }> = []

  for (const entity of entities) {
    const renderer = resolveRendererForStationEntity(entity)
    const slotX = entity.slot.x
    const slotY =
      entity.kind === 'building_slot'
        ? entity.slot.y - entity.slot.height * BUILDING_HIT_CENTER_OFFSET_Y_FACTOR
        : entity.slot.y
    const hitRadius = renderer.getHitRadius(toStationRendererData(entity), scale)
    const dx = slotX - worldX
    const dy = slotY - worldY
    const distanceSquared = dx * dx + dy * dy

    if (distanceSquared <= hitRadius * hitRadius) {
      candidates.push({ slotIndex: entity.slot.slotIndex, distanceSquared })
    }
  }

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((a, b) => a.distanceSquared - b.distanceSquared)
  return candidates[0].slotIndex
}
