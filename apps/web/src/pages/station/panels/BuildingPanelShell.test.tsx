import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BuildingPanelShell } from './BuildingPanelShell'

function createContext(overrides: Record<string, unknown> = {}) {
  return {
    inventory: [],
    buildableBuildings: [],
    miningRigCapacity: 1,
    activeMiningOperations: [],
    uiNowMs: Date.now(),
    isActionPending: false,
    actionError: null,
    onBuildBuilding: vi.fn(async () => {}),
    onUpgradeBuilding: vi.fn(async () => {}),
    onRecallMiningOperation: vi.fn(async () => {}),
    onGoToMap: vi.fn(),
    ...overrides,
  } as any
}

describe('BuildingPanelShell', () => {
  it('disables upgrade action when building is already upgrading', () => {
    render(
      <BuildingPanelShell
        title="Refinery"
        placeholder="Placeholder"
        data={{
          buildingId: 'building-1',
          slotIndex: 1,
          level: 1,
          status: 'upgrading',
        }}
        context={createContext()}
      />,
    )

    const button = screen.getByRole('button', { name: /upgrading/i })
    expect(button).toBeDisabled()
  })

  it('triggers upgrade callback when building is idle', () => {
    const onUpgradeBuilding = vi.fn(async () => {})

    render(
      <BuildingPanelShell
        title="Refinery"
        placeholder="Placeholder"
        data={{
          buildingId: 'building-1',
          slotIndex: 1,
          level: 1,
          status: 'idle',
        }}
        context={createContext({ onUpgradeBuilding })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^upgrade$/i }))
    expect(onUpgradeBuilding).toHaveBeenCalledWith('building-1')
  })
})
