import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StationContext } from '../../../../features/station/StationProvider'
import { AbstractPanel } from './AbstractPanel'

const baseProps = {
  onClose: vi.fn(),
}

describe('AbstractPanel', () => {
  const stationState: any = {
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

  it('renders station panel when selected element is station', () => {
    render(
      <StationContext.Provider value={stationState}>
        <AbstractPanel
          {...baseProps}
          selectedElement={{
            type: 'station',
            data: { id: 'station-1', name: 'Commander Base', x: 140, y: -25 },
          }}
        />
      </StationContext.Provider>,
    )

    expect(screen.getByText('Station')).toBeInTheDocument()
    expect(screen.getByText('Commander Base')).toBeInTheDocument()
  })

  it('renders asteroid panel when selected element is asteroid', () => {
    render(
      <StationContext.Provider value={stationState}>
        <AbstractPanel
          {...baseProps}
          selectedElement={{
            type: 'asteroid',
            data: {
              id: 'ast-1',
              x: 10,
              y: 20,
              isScanned: true,
              name: 'Metal-Rich Fragment',
              yieldMultiplier: 1.15,
              scannedRemainingUnits: 999,
            },
          }}
        />
      </StationContext.Provider>,
    )

    expect(screen.getByText('Asteroid')).toBeInTheDocument()
    expect(screen.getByText('Metal-Rich Fragment')).toBeInTheDocument()
  })
})
