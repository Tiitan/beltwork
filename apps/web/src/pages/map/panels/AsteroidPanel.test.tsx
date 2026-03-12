import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StationContext } from '../../../features/station/StationProvider'
import { AsteroidPanel } from './AsteroidPanel'

const scanAsteroidMock = vi.fn(async (_asteroidId: string) => {})

vi.mock('../../../features/station/api', () => ({
  scanAsteroid: (asteroidId: string) => scanAsteroidMock(asteroidId),
}))

function buildState() {
  return {
    mapSnapshot: {
      worldBounds: { minX: 0, maxX: 10000, minY: 0, maxY: 10000 },
      stations: [],
      asteroids: [],
    },
    mapEntities: [],
    mapError: null,
    isMapLoading: false,
    playerStation: null,
    playerAnchor: null,
    selectedElementRef: null,
    selectedElement: null,
    setSelectedElementRef: vi.fn(),
    clearSelectedElement: vi.fn(),
    refreshMapSnapshot: vi.fn(async () => {}),
    refreshStationSnapshot: vi.fn(async () => {}),
    inventory: [],
    inventoryError: null,
    buildings: [],
    buildableBuildings: [],
    miningRigCapacity: 1,
    activeMiningOperations: [],
    uiNowMs: Date.now(),
    isStationActionPending: false,
    deployMiningRigToAsteroid: vi.fn(async () => {}),
    recallMiningOperationById: vi.fn(async () => {}),
    buildBuildingInSlot: vi.fn(async () => {}),
    upgradeBuildingById: vi.fn(async () => {}),
  }
}

describe('AsteroidPanel', () => {
  it('runs scan and refreshes map on success', async () => {
    const state: any = buildState()

    render(
      <StationContext.Provider value={state}>
        <AsteroidPanel
          asteroid={{ id: 'ast-1', x: 10, y: 20, isScanned: false }}
          context={{ onClose: vi.fn() }}
        />
      </StationContext.Provider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))

    expect(await screen.findByText('Scan completed for target ast-1.')).toBeInTheDocument()
    expect(scanAsteroidMock).toHaveBeenCalledWith('ast-1')
    expect(state.refreshMapSnapshot).toHaveBeenCalledTimes(1)
  })

  it('shows failure when scan request fails', async () => {
    const state: any = buildState()
    scanAsteroidMock.mockRejectedValueOnce(new Error('boom'))

    render(
      <StationContext.Provider value={state}>
        <AsteroidPanel
          asteroid={{ id: 'ast-2', x: 10, y: 20, isScanned: false }}
          context={{ onClose: vi.fn() }}
        />
      </StationContext.Provider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Scan' }))

    expect(await screen.findByText('Scan failed for target ast-2.')).toBeInTheDocument()
    expect(state.refreshMapSnapshot).not.toHaveBeenCalled()
  })

  it('deploys mining rig and shows success message', async () => {
    const state: any = buildState()

    render(
      <StationContext.Provider value={state}>
        <AsteroidPanel
          asteroid={{ id: 'ast-3', x: 10, y: 20, isScanned: false }}
          context={{ onClose: vi.fn() }}
        />
      </StationContext.Provider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Deploy mining rig' }))

    expect(await screen.findByText('Mining rig deployed toward target ast-3.')).toBeInTheDocument()
    expect(state.deployMiningRigToAsteroid).toHaveBeenCalledWith('ast-3')
  })

  it('renders mining rig activity only for the selected asteroid', () => {
    const state: any = buildState()
    state.activeMiningOperations = [
      {
        id: 'aaaaaaa1-0000-0000-0000-000000000001',
        asteroidId: 'ast-5',
        status: 'mining',
        phaseStartedAt: '2026-03-11T12:00:00.000Z',
        phaseFinishAt: '2026-03-11T12:01:00.000Z',
        returnOriginProgress: null,
        quantity: 10,
        quantityTarget: 60,
        cargoCapacity: 600,
        estimatedAsteroidRemainingUnits: 500,
        asteroidRemainingUnitsAtMiningStart: 500,
      },
      {
        id: 'bbbbbbb2-0000-0000-0000-000000000002',
        asteroidId: 'ast-6',
        status: 'flying_to_destination',
        phaseStartedAt: '2026-03-11T12:00:00.000Z',
        phaseFinishAt: '2026-03-11T12:01:00.000Z',
        returnOriginProgress: null,
        quantity: 0,
        quantityTarget: 0,
        cargoCapacity: 600,
        estimatedAsteroidRemainingUnits: 400,
        asteroidRemainingUnitsAtMiningStart: null,
      },
    ]
    state.uiNowMs = Date.parse('2026-03-11T12:00:30.000Z')

    render(
      <StationContext.Provider value={state}>
        <AsteroidPanel
          asteroid={{ id: 'ast-5', x: 10, y: 20, isScanned: true, name: 'Target' }}
          context={{ onClose: vi.fn() }}
        />
      </StationContext.Provider>,
    )

    expect(screen.getByText('Mining rig activity')).toBeInTheDocument()
    expect(screen.getByText('Op #aaaaaaa1')).toBeInTheDocument()
    expect(screen.queryByText('Op #bbbbbbb2')).not.toBeInTheDocument()
  })

  it('shows empty state when selected asteroid has no active mining operation', () => {
    const state: any = buildState()

    render(
      <StationContext.Provider value={state}>
        <AsteroidPanel
          asteroid={{ id: 'ast-9', x: 10, y: 20, isScanned: true, name: 'Quiet Rock' }}
          context={{ onClose: vi.fn() }}
        />
      </StationContext.Provider>,
    )

    expect(screen.getByText('No active mining operation on this asteroid.')).toBeInTheDocument()
  })
})
