import type { ReactNode } from 'react'
import type {
  MapCoordinates,
  MapElementType,
  MapAsteroid,
  MapPanelContext,
  MapStation,
} from '../../../../types/app'

export type MapEntityPanelProps<TData> = {
  data: TData
  context: MapPanelContext
}

export type MapEntityRenderer<TData> = {
  type: MapElementType
  getLabel: (data: TData) => string
  getCoordinates: (data: TData) => MapCoordinates
  getIconPath: (data: TData) => string
  getIconSize: (data: TData) => number
  getFallbackColor: (data: TData) => string
  getSelectionStyle: (data: TData) => {
    strokeStyle: string
    lineWidth: number
    radiusScale: number
  }
  getHitRadius: (data: TData, scale: number) => number
  renderTooltip: (data: TData) => ReactNode
  renderPanel: (props: MapEntityPanelProps<TData>) => ReactNode
}

export type MapEntityRendererRegistry = {
  station: MapEntityRenderer<MapStation>
  asteroid: MapEntityRenderer<MapAsteroid>
}
