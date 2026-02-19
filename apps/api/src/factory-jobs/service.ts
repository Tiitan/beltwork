import { z } from 'zod'

/**
 * Canonical factory job state used by API handlers and domain logic.
 */
export type FactoryJob = {
  id: string
  factoryId: string
  blueprintKey: string | null
  selectedAt: Date
  dueAt: Date | null
  cyclesCompleted: number
  targetCycles: number | null
  completedAt: Date | null
}

/**
 * Input schema for selecting a blueprint on a factory.
 */
export const selectBlueprintInputSchema = z
  .object({
    blueprint_key: z.string().min(1),
    is_infinite: z.boolean(),
    target_cycles: z.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.is_infinite && value.target_cycles === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target_cycles'],
        message: 'target_cycles is required when is_infinite is false',
      })
    }
  })

/**
 * Parsed payload type for blueprint selection.
 */
export type SelectBlueprintInput = z.infer<typeof selectBlueprintInputSchema>

/**
 * Input schema for advancing a factory job simulation.
 */
export const catchUpInputSchema = z.object({
  elapsed_seconds: z.number().int().nonnegative(),
  available_input_cycles: z.number().int().nonnegative(),
  output_capacity_cycles: z.number().int().nonnegative(),
  cycle_duration_seconds: z.number().int().positive().default(60),
})

/**
 * Parsed payload type for factory catch-up simulation.
 */
export type CatchUpInput = z.infer<typeof catchUpInputSchema>

/**
 * Creates a new selected factory job from blueprint selection input.
 *
 * @param factoryId Factory identifier.
 * @param input Validated blueprint selection payload.
 * @param now Current timestamp reference.
 * @returns Newly initialized factory job.
 */
export function createSelectedJob(
  factoryId: string,
  input: SelectBlueprintInput,
  now: Date,
): FactoryJob {
  return {
    id: factoryId,
    factoryId,
    blueprintKey: input.blueprint_key,
    selectedAt: now,
    dueAt: new Date(now.getTime() + 60_000),
    cyclesCompleted: 0,
    targetCycles: input.is_infinite ? null : (input.target_cycles ?? null),
    completedAt: null,
  }
}

/**
 * Clears the active blueprint and marks the job completed at the provided time.
 *
 * @param job Existing factory job state.
 * @param now Timestamp used as completion time.
 * @returns Updated job with cleared blueprint.
 */
export function clearBlueprint(job: FactoryJob, now: Date): FactoryJob {
  return {
    ...job,
    blueprintKey: null,
    dueAt: null,
    completedAt: now,
  }
}

/**
 * Simulates production catch-up based on elapsed time and capacity constraints.
 *
 * @param job Existing factory job state.
 * @param input Catch-up payload with elapsed and capacity data.
 * @returns Updated factory job state after simulation.
 * @remarks Finite jobs complete at target cycles, and blocked jobs auto-complete.
 */
export function catchUpFactoryJob(job: FactoryJob, input: CatchUpInput): FactoryJob {
  if (job.completedAt !== null) {
    return job
  }

  const elapsedSeconds = input.elapsed_seconds
  const cycleDurationSeconds = input.cycle_duration_seconds
  const timeCycles = Math.floor(elapsedSeconds / cycleDurationSeconds)
  const now = new Date(job.selectedAt.getTime() + elapsedSeconds * 1000)

  if (timeCycles <= 0) {
    return {
      ...job,
      dueAt: new Date(now.getTime() + cycleDurationSeconds * 1000),
    }
  }

  const resourceCapacityCycles = Math.min(
    input.available_input_cycles,
    input.output_capacity_cycles,
  )
  let actualCycles = Math.min(timeCycles, resourceCapacityCycles)

  if (job.targetCycles !== null) {
    const remaining = Math.max(job.targetCycles - job.cyclesCompleted, 0)
    actualCycles = Math.min(actualCycles, remaining)
  }

  const next: FactoryJob = {
    ...job,
    cyclesCompleted: job.cyclesCompleted + actualCycles,
  }

  if (next.targetCycles !== null && next.cyclesCompleted >= next.targetCycles) {
    return {
      ...next,
      completedAt: now,
      dueAt: null,
    }
  }

  if (actualCycles < timeCycles) {
    return {
      ...next,
      dueAt: null,
      completedAt: now,
    }
  }

  return {
    ...next,
    dueAt: new Date(now.getTime() + cycleDurationSeconds * 1000),
  }
}

/**
 * Maps internal job state to the API response contract.
 *
 * @param job Domain factory job state.
 * @returns Serialized read model returned by API handlers.
 */
export function toFactoryJobReadModel(job: FactoryJob) {
  const remainingCycles =
    job.targetCycles === null ? null : Math.max(job.targetCycles - job.cyclesCompleted, 0)

  return {
    id: job.id,
    factory_id: job.factoryId,
    blueprint_key: job.blueprintKey,
    cycles_completed: job.cyclesCompleted,
    target_cycles: job.targetCycles,
    remaining_cycles: remainingCycles,
    is_infinite: job.targetCycles === null,
    selected_at: job.selectedAt.toISOString(),
    due_at: job.dueAt?.toISOString() ?? null,
    completed_at: job.completedAt?.toISOString() ?? null,
  }
}
