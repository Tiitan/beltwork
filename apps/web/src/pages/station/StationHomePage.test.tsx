import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { StationContext } from '../../features/station/StationProvider'
import { StationHomePage } from './StationHomePage'

beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        top: 0,
        right: 800,
        bottom: 600,
        left: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  )
})

function buildBaseState(overrides: Record<string, unknown> = {}) {
  return {
    inventory: [],
    inventoryError: null,
    mapSnapshot: {
      worldBounds: { minX: 0, maxX: 10000, minY: 0, maxY: 10000 },
      stations: [],
      asteroids: [],
    },
    mapError: null,
    isMapLoading: false,
    playerStation: { id: 'station-1', x: 140, y: -25 },
    playerAnchor: { id: 'station-1', x: 140, y: -25 },
    mapEntities: [],
    buildings: [],
    buildableBuildings: [
      { id: 'fusion_reactor', name: 'Fusion Reactor' },
      { id: 'life_support', name: 'Life Support' },
      { id: 'storage', name: 'Storage' },
    ],
    miningRigCapacity: 1,
    activeMiningOperations: [],
    uiNowMs: Date.now(),
    isStationActionPending: false,
    isBuildingPending: false,
    selectedElement: null,
    selectedElementRef: null,
    setSelectedElementRef: vi.fn(),
    clearSelectedElement: vi.fn(),
    refreshMapSnapshot: vi.fn(async () => {}),
    refreshStationSnapshot: vi.fn(async () => {}),
    buildBuildingInSlot: vi.fn(async () => {}),
    upgradeBuildingById: vi.fn(async () => {}),
    deployMiningRigToAsteroid: vi.fn(async () => {}),
    recallMiningOperationById: vi.fn(async () => {}),
    ...overrides,
  } as any
}

function renderWithState(state: any) {
  return render(
    <MemoryRouter initialEntries={['/station']}>
      <Routes>
        <Route
          path="/station"
          element={
            <StationContext.Provider value={state}>
              <StationHomePage />
            </StationContext.Provider>
          }
        />
        <Route path="/map" element={<p>Map route</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function clickSlotOne() {
  const canvas = document.querySelector('canvas')
  if (!canvas) {
    throw new Error('canvas_not_found')
  }

  fireEvent.pointerDown(canvas, { clientX: 255, clientY: 194 })
  fireEvent.pointerUp(canvas, { clientX: 255, clientY: 194 })
}

function clickSlotOneBuilding() {
  const canvas = document.querySelector('canvas')
  if (!canvas) {
    throw new Error('canvas_not_found')
  }

  fireEvent.pointerDown(canvas, { clientX: 255, clientY: 165 })
  fireEvent.pointerUp(canvas, { clientX: 255, clientY: 165 })
}

describe('StationHomePage', () => {
  it('opens empty slot panel with buildable buildings', async () => {
    const state = buildBaseState()
    renderWithState(state)

    await waitFor(() => expect(screen.getByLabelText(/station page canvas/i)).toBeInTheDocument())
    clickSlotOne()

    expect(await screen.findByRole('heading', { name: /empty slot #1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fusion reactor/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /life support/i })).toBeInTheDocument()
    expect(screen.getByAltText('Fusion Reactor icon')).toBeInTheDocument()
  })

  it('calls build action when selecting a building from empty slot panel', async () => {
    const buildBuildingInSlot = vi.fn(async () => {})
    const state = buildBaseState({ buildBuildingInSlot })
    renderWithState(state)

    await waitFor(() => expect(screen.getByLabelText(/station page canvas/i)).toBeInTheDocument())
    clickSlotOne()
    fireEvent.click(await screen.findByRole('button', { name: /fusion reactor/i }))

    await waitFor(() => expect(buildBuildingInSlot).toHaveBeenCalledWith(1, 'fusion_reactor'))
  })

  it('opens fusion reactor placeholder panel for occupied slot', async () => {
    const state = buildBaseState({
      buildings: [
        {
          id: 'building-1',
          type: 'fusion_reactor',
          level: 1,
          status: 'idle',
          upgradeFinishAt: null,
          slotIndex: 1,
        },
      ],
    })

    renderWithState(state)
    await waitFor(() => expect(screen.getByLabelText(/station page canvas/i)).toBeInTheDocument())
    clickSlotOneBuilding()

    expect(await screen.findByRole('heading', { name: /fusion reactor/i })).toBeInTheDocument()
    expect(screen.getByText(/slot: 1/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument()
  })

  it('shows storage inventory list with icons and counts', async () => {
    const state = buildBaseState({
      inventory: [
        { resourceKey: 'water', amount: 100 },
        { resourceKey: 'carbon_materials', amount: 15 },
      ],
      buildings: [
        {
          id: 'building-1',
          type: 'storage',
          level: 2,
          status: 'idle',
          upgradeFinishAt: null,
          slotIndex: 1,
        },
      ],
    })

    renderWithState(state)
    await waitFor(() => expect(screen.getByLabelText(/station page canvas/i)).toBeInTheDocument())
    clickSlotOneBuilding()

    expect(await screen.findByRole('heading', { name: /storage/i })).toBeInTheDocument()
    expect(screen.getByText('Inventory')).toBeInTheDocument()
    expect(screen.getByAltText('Water icon')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('calls upgrade action with building id', async () => {
    const upgradeBuildingById = vi.fn(async () => {})
    const state = buildBaseState({
      buildings: [
        {
          id: 'building-1',
          type: 'refinery',
          level: 1,
          status: 'idle',
          upgradeFinishAt: null,
          slotIndex: 1,
        },
      ],
      upgradeBuildingById,
    })

    renderWithState(state)
    await waitFor(() => expect(screen.getByLabelText(/station page canvas/i)).toBeInTheDocument())
    clickSlotOneBuilding()
    fireEvent.click(await screen.findByRole('button', { name: /upgrade/i }))

    await waitFor(() => expect(upgradeBuildingById).toHaveBeenCalledWith('building-1'))
  })

  it('navigates to map from scanner and survey panel', async () => {
    const state = buildBaseState({
      buildings: [
        {
          id: 'building-1',
          type: 'scanner_survey',
          level: 1,
          status: 'idle',
          upgradeFinishAt: null,
          slotIndex: 1,
        },
      ],
    })

    renderWithState(state)
    await waitFor(() => expect(screen.getByLabelText(/station page canvas/i)).toBeInTheDocument())
    clickSlotOneBuilding()
    fireEvent.click(await screen.findByRole('button', { name: /go to map/i }))

    expect(await screen.findByText('Map route')).toBeInTheDocument()
  })
})
