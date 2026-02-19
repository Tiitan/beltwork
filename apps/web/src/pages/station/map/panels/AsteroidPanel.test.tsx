import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StationContext } from '../../../../features/station/StationProvider'
import { AsteroidPanel } from './AsteroidPanel'

const scanAsteroidMock = vi.fn(async (_asteroidId: string) => {})

vi.mock('../../../../features/station/api', () => ({
  scanAsteroid: (asteroidId: string) => scanAsteroidMock(asteroidId),
}))

function buildState() {
  return {
    mapSnapshot: { stations: [], asteroids: [] },
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
    inventory: [],
    inventoryError: null,
    buildings: [],
    selectedRecipeKey: 'rcp_refine_metal_plates',
    setSelectedRecipeKey: vi.fn(),
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

  it('shows deploy placeholder message', async () => {
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

    expect(
      await screen.findByText('Deploy mining rig not implemented yet for target ast-3.'),
    ).toBeInTheDocument()
  })
})
