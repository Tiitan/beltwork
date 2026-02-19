import {
  getAsteroidIconPath,
  getDefaultAsteroidIconPath,
  getStationIconPath,
} from '../../../../features/station/iconPaths'
import type { MapAsteroid, MapElement, MapElementType, MapStation } from '../../../../types/app'
import { AsteroidPanel } from './AsteroidPanel'
import { formatCoordinates } from './panelUtils'
import { StationPanel } from './StationPanel'
import type { MapEntityRenderer, MapEntityRendererRegistry } from './types'

const stationRenderer: MapEntityRendererRegistry['station'] = {
  type: 'station',
  getLabel: (data) => data.name,
  getCoordinates: (data) => ({ x: data.x, y: data.y }),
  getIconPath: () => getStationIconPath(),
  getIconSize: () => 44,
  getFallbackColor: () => '#6ee7f9',
  getSelectionStyle: () => ({
    strokeStyle: '#38bdf8',
    lineWidth: 2,
    radiusScale: 0.72,
  }),
  getHitRadius: (_data, scale) => (44 * 0.5) / scale,
  renderTooltip: (data) => (
    <>
      <p className="font-semibold text-sky-100">{data.name}</p>
      <p>{formatCoordinates(data.x, data.y)}</p>
    </>
  ),
  renderPanel: ({ data }) => <StationPanel station={data} />,
}

const asteroidRenderer: MapEntityRendererRegistry['asteroid'] = {
  type: 'asteroid',
  getLabel: (data) => (data.isScanned ? (data.name ?? 'Unknown Asteroid') : 'Unknown Asteroid'),
  getCoordinates: (data) => ({ x: data.x, y: data.y }),
  getIconPath: (data) =>
    data.isScanned && data.templateId
      ? getAsteroidIconPath(`ast_${data.templateId}`)
      : getDefaultAsteroidIconPath(),
  getIconSize: () => 36,
  getFallbackColor: () => '#fbbf24',
  getSelectionStyle: () => ({
    strokeStyle: '#34d399',
    lineWidth: 2,
    radiusScale: 0.7,
  }),
  getHitRadius: (_data, scale) => (36 * 0.5) / scale,
  renderTooltip: (data) => (
    <>
      <p className="font-semibold text-sky-100">
        {data.isScanned ? (data.name ?? 'Unknown Asteroid') : 'Unknown Asteroid'}
      </p>
      <p>{formatCoordinates(data.x, data.y)}</p>
    </>
  ),
  renderPanel: ({ data, context }) => <AsteroidPanel asteroid={data} context={context} />,
}

export const entityRenderers: MapEntityRendererRegistry = {
  station: stationRenderer,
  asteroid: asteroidRenderer,
}

export function getEntityRenderer(type: 'station'): MapEntityRenderer<MapStation>
export function getEntityRenderer(type: 'asteroid'): MapEntityRenderer<MapAsteroid>
export function getEntityRenderer(type: MapElementType) {
  return entityRenderers[type]
}

export function resolveRendererForElement(element: MapElement): MapEntityRenderer<any> {
  return entityRenderers[element.type]
}
