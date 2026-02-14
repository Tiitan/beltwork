import { z } from 'zod'

export type FactoryJob = {
  id: string
  factoryId: string
  recipeKey: string | null
  selectedAt: Date
  dueAt: Date | null
  cyclesCompleted: number
  targetCycles: number | null
  completedAt: Date | null
}

export const selectRecipeInputSchema = z
  .object({
    recipe_key: z.string().min(1),
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

export type SelectRecipeInput = z.infer<typeof selectRecipeInputSchema>

export const catchUpInputSchema = z.object({
  elapsed_seconds: z.number().int().nonnegative(),
  available_input_cycles: z.number().int().nonnegative(),
  output_capacity_cycles: z.number().int().nonnegative(),
  cycle_duration_seconds: z.number().int().positive().default(60),
})

export type CatchUpInput = z.infer<typeof catchUpInputSchema>

export function createSelectedJob(
  factoryId: string,
  input: SelectRecipeInput,
  now: Date,
): FactoryJob {
  return {
    id: factoryId,
    factoryId,
    recipeKey: input.recipe_key,
    selectedAt: now,
    dueAt: new Date(now.getTime() + 60_000),
    cyclesCompleted: 0,
    targetCycles: input.is_infinite ? null : (input.target_cycles ?? null),
    completedAt: null,
  }
}

export function clearRecipe(job: FactoryJob, now: Date): FactoryJob {
  return {
    ...job,
    recipeKey: null,
    dueAt: null,
    completedAt: now,
  }
}

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

export function toFactoryJobReadModel(job: FactoryJob) {
  const remainingCycles =
    job.targetCycles === null ? null : Math.max(job.targetCycles - job.cyclesCompleted, 0)

  return {
    id: job.id,
    factory_id: job.factoryId,
    recipe_key: job.recipeKey,
    cycles_completed: job.cyclesCompleted,
    target_cycles: job.targetCycles,
    remaining_cycles: remainingCycles,
    is_infinite: job.targetCycles === null,
    selected_at: job.selectedAt.toISOString(),
    due_at: job.dueAt?.toISOString() ?? null,
    completed_at: job.completedAt?.toISOString() ?? null,
  }
}
