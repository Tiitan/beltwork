import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { StationContext } from '../../features/station/StationProvider'
import { MapPage } from './MapPage'

const scanAsteroidMock = vi.fn(async (_asteroidId: string) => {})

vi.mock('../../features/station/api', () => ({
  scanAsteroid: (asteroidId: string) => scanAsteroidMock(asteroidId),
}))

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

function buildBaseState() {
  const mapSnapshot = {
    stations: [{ id: 'station-1', name: 'Commander Base', x: 140, y: -25 }],
    asteroids: [
      {
        id: 'asteroid-1',
        x: 300,
        y: 400,
        isScanned: true,
        name: 'Metal-Rich Fragment',
        yieldMultiplier: 1.15,
        scannedRemainingUnits: 999,
        scannedAt: '2026-02-19T12:00:00.000Z',
        composition: { metals: 0.7, conductors: 0.15, carbon_materials: 0.1, water: 0.05 },
      },
    ],
  }
  const state: any = {
    mapSnapshot,
    mapEntities: [
      ...mapSnapshot.stations.map((item: any) => ({ type: 'station', data: item })),
      ...mapSnapshot.asteroids.map((item: any) => ({ type: 'asteroid', data: item })),
    ],
    mapError: null,
    isMapLoading: false,
    playerStation: { id: 'station-1', x: 140, y: -25 },
    playerAnchor: { id: 'station-1', x: 140, y: -25 },
    selectedElementRef: null,
    selectedElement: null,
    setSelectedElementRef: vi.fn(),
    clearSelectedElement: vi.fn(),
    refreshMapSnapshot: vi.fn(async () => {}),
    inventory: [],
    inventoryError: null,
    buildings: [],
    selectedBlueprintKey: 'bp_refine_metal_plates',
    setSelectedBlueprintKey: vi.fn(),
  }
  return state
}

function renderWithState(state: any) {
  return render(
    <StationContext.Provider value={state}>
      <MapPage />
    </StationContext.Provider>,
  )
}

describe('MapPage details panel', () => {
  it('renders station details when a station is selected', () => {
    const state = buildBaseState()
    state.selectedElementRef = { type: 'station', id: 'station-1' }
    state.selectedElement = { type: 'station', data: state.mapSnapshot.stations[0] }

    renderWithState(state)

    expect(screen.getByText('Station')).toBeInTheDocument()
    expect(screen.getByText('Commander Base')).toBeInTheDocument()
    expect(screen.getByText('X: 140 | Y: -25')).toBeInTheDocument()
  })

  it('renders scanned asteroid details and action placeholder message', async () => {
    const state = buildBaseState()
    state.selectedElementRef = { type: 'asteroid', id: 'asteroid-1' }
    state.selectedElement = { type: 'asteroid', data: state.mapSnapshot.asteroids[0] }

    renderWithState(state)

    expect(screen.getByText('Asteroid')).toBeInTheDocument()
    expect(screen.getByText('Metal-Rich Fragment')).toBeInTheDocument()
    expect(screen.getByText('Yield multiplier: 1.15')).toBeInTheDocument()
    expect(screen.getByText('Remaining units (scan): 999')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))
    expect(await screen.findByText('Scan completed for target asteroid-1.')).toBeInTheDocument()
  })

  it('renders unknown placeholders for unscanned asteroid', () => {
    const state = buildBaseState()
    state.mapSnapshot.asteroids = [{ id: 'asteroid-2', x: 500, y: 600, isScanned: false }]
    state.mapEntities = [
      ...state.mapSnapshot.stations.map((item: any) => ({ type: 'station', data: item })),
      ...state.mapSnapshot.asteroids.map((item: any) => ({ type: 'asteroid', data: item })),
    ]
    state.selectedElementRef = { type: 'asteroid', id: 'asteroid-2' }
    state.selectedElement = { type: 'asteroid', data: state.mapSnapshot.asteroids[0] }

    renderWithState(state)

    expect(screen.getByText('Unknown Asteroid')).toBeInTheDocument()
    expect(screen.getByText('Yield multiplier: Unknown (scan required)')).toBeInTheDocument()
    expect(screen.getByText('Resources: Unknown (scan required)')).toBeInTheDocument()
  })
})
