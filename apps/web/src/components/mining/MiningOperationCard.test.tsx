import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MiningOperationCard } from './MiningOperationCard'

describe('MiningOperationCard', () => {
  it('shows mining remaining label and interpolated cargo while mining', () => {
    render(
      <ul>
        <MiningOperationCard
          operation={{
            id: 'op-1',
            asteroidId: 'ast-1',
            status: 'mining',
            phaseStartedAt: '2026-03-11T12:00:00.000Z',
            phaseFinishAt: '2026-03-11T12:00:10.000Z',
            returnOriginProgress: null,
            quantity: 0,
            quantityTarget: 100,
            cargoCapacity: 500,
            estimatedAsteroidRemainingUnits: 1000,
            asteroidRemainingUnitsAtMiningStart: 900,
          }}
          uiNowMs={Date.parse('2026-03-11T12:00:05.000Z')}
          isActionPending={false}
          onRecall={vi.fn()}
        />
      </ul>,
    )

    expect(screen.getByText('Cargo: 50/500')).toBeInTheDocument()
    expect(screen.getByText('Remaining units: 850')).toBeInTheDocument()
    expect(screen.queryByText(/Real remaining units/i)).not.toBeInTheDocument()
  })
})
