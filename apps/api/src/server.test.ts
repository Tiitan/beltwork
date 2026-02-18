import { describe, expect, it } from 'vitest'
import { buildServer } from './server.js'

/**
 * Minimal event shape used for asserting emitted event types.
 */
type EventTypeOnly = { event_type: string }

/**
 * Projects event arrays to a list of event type identifiers.
 *
 * @param events API event array.
 * @returns Ordered event type list.
 */
function eventTypes(events: EventTypeOnly[]): string[] {
  return events.map((event) => event.event_type)
}

/**
 * Verifies liveness and readiness endpoint behavior.
 */
describe('observability routes', () => {
  it('returns live status', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'GET',
      url: '/live',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('returns ready when database check passes', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ready' })
  })

  it('returns not_ready when database check fails', async () => {
    const app = buildServer({
      checkReadiness: async () => {
        throw new Error('db unavailable')
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: 'not_ready' })
  })
})

describe('google auth api', () => {
  it('returns invalid_google_token when verifier rejects token', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
      verifyGoogleIdToken: async () => {
        throw new Error('bad token')
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/google',
      payload: {
        id_token: 'invalid-token',
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'invalid_google_token' })
  })
})

/**
 * Verifies factory API behavior for validation and production lifecycle.
 */
describe('factory jobs api', () => {
  it('validates finite queue payload', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/factories/f-1/select-recipe',
      payload: {
        recipe_key: 'rcp_refine_metal_plates',
        is_infinite: false,
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('stops finite production exactly at target cycles', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    const selectResponse = await app.inject({
      method: 'POST',
      url: '/v1/factories/f-2/select-recipe',
      payload: {
        recipe_key: 'rcp_refine_metal_plates',
        is_infinite: false,
        target_cycles: 3,
      },
    })

    expect(selectResponse.statusCode).toBe(200)
    expect(selectResponse.json().events[0].event_type).toBe('factory.recipe.selected')

    const catchUpResponse = await app.inject({
      method: 'POST',
      url: '/v1/factories/f-2/catch-up',
      payload: {
        elapsed_seconds: 300,
        cycle_duration_seconds: 60,
        available_input_cycles: 10,
        output_capacity_cycles: 10,
      },
    })

    expect(catchUpResponse.statusCode).toBe(200)
    expect(catchUpResponse.json().job.cycles_completed).toBe(3)
    expect(catchUpResponse.json().job.target_cycles).toBe(3)
    expect(catchUpResponse.json().job.remaining_cycles).toBe(0)
    expect(catchUpResponse.json().job.completed_at).not.toBeNull()
    expect(eventTypes(catchUpResponse.json().events)).toEqual([
      'inventory.changed',
      'factory.production.completed',
    ])
  })

  it('keeps infinite production running while capacity allows', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    await app.inject({
      method: 'POST',
      url: '/v1/factories/f-3/select-recipe',
      payload: {
        recipe_key: 'rcp_refine_wire_spools',
        is_infinite: true,
      },
    })

    const catchUpResponse = await app.inject({
      method: 'POST',
      url: '/v1/factories/f-3/catch-up',
      payload: {
        elapsed_seconds: 180,
        cycle_duration_seconds: 60,
        available_input_cycles: 5,
        output_capacity_cycles: 5,
      },
    })

    expect(catchUpResponse.statusCode).toBe(200)
    expect(catchUpResponse.json().job.target_cycles).toBeNull()
    expect(catchUpResponse.json().job.is_infinite).toBe(true)
    expect(catchUpResponse.json().job.completed_at).toBeNull()
  })

  it('auto-cancels when blocked by insufficient resources', async () => {
    const app = buildServer({
      checkReadiness: async () => {},
    })

    await app.inject({
      method: 'POST',
      url: '/v1/factories/f-4/select-recipe',
      payload: {
        recipe_key: 'rcp_refine_coolant_cells',
        is_infinite: false,
        target_cycles: 10,
      },
    })

    const blockedResponse = await app.inject({
      method: 'POST',
      url: '/v1/factories/f-4/catch-up',
      payload: {
        elapsed_seconds: 180,
        cycle_duration_seconds: 60,
        available_input_cycles: 1,
        output_capacity_cycles: 8,
      },
    })

    expect(blockedResponse.statusCode).toBe(200)
    expect(blockedResponse.json().job.completed_at).not.toBeNull()

    const getPaused = await app.inject({
      method: 'GET',
      url: '/v1/factories/f-4',
    })

    expect(getPaused.statusCode).toBe(200)
    expect(getPaused.json().job.completed_at).not.toBeNull()
  })
})
