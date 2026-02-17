import { describe, expect, it } from 'vitest'
import {
  catchUpFactoryJob,
  createSelectedJob,
  selectRecipeInputSchema,
  type SelectRecipeInput,
} from './service.js'

/**
 * Preserves inferred literal types for test payload fixtures.
 *
 * @param value Recipe input fixture.
 * @returns The same fixture value with `SelectRecipeInput` typing.
 */
function makeInput(value: SelectRecipeInput): SelectRecipeInput {
  return value
}

/**
 * Validates factory domain rules for queueing and catch-up behavior.
 */
describe('factory job domain logic', () => {
  it('rejects non-positive target cycles for finite jobs', () => {
    const parsed = selectRecipeInputSchema.safeParse({
      recipe_key: 'rcp_refine_metal_plates',
      is_infinite: false,
      target_cycles: 0,
    })

    expect(parsed.success).toBe(false)
  })

  it('completes finite job exactly at target', () => {
    const now = new Date('2026-02-14T10:00:00.000Z')
    const job = createSelectedJob(
      'factory-a',
      makeInput({
        recipe_key: 'rcp_refine_metal_plates',
        is_infinite: false,
        target_cycles: 2,
      }),
      now,
    )

    const next = catchUpFactoryJob(job, {
      elapsed_seconds: 600,
      cycle_duration_seconds: 60,
      available_input_cycles: 10,
      output_capacity_cycles: 10,
    })

    expect(next.cyclesCompleted).toBe(2)
    expect(next.completedAt).not.toBeNull()
  })

  it('never auto-completes infinite jobs', () => {
    const now = new Date('2026-02-14T10:00:00.000Z')
    const job = createSelectedJob(
      'factory-b',
      makeInput({
        recipe_key: 'rcp_refine_wire_spools',
        is_infinite: true,
      }),
      now,
    )

    const next = catchUpFactoryJob(job, {
      elapsed_seconds: 180,
      cycle_duration_seconds: 60,
      available_input_cycles: 3,
      output_capacity_cycles: 3,
    })

    expect(next.targetCycles).toBeNull()
    expect(next.completedAt).toBeNull()
  })

  it('auto-cancels blocked jobs', () => {
    const now = new Date('2026-02-14T10:00:00.000Z')
    const job = createSelectedJob(
      'factory-c',
      makeInput({
        recipe_key: 'rcp_refine_coolant_cells',
        is_infinite: false,
        target_cycles: 10,
      }),
      now,
    )

    const paused = catchUpFactoryJob(job, {
      elapsed_seconds: 180,
      cycle_duration_seconds: 60,
      available_input_cycles: 1,
      output_capacity_cycles: 5,
    })

    expect(paused.completedAt).not.toBeNull()
  })
})
