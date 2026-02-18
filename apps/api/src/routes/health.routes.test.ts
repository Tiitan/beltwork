import { describe, expect, it } from 'vitest'
import { buildServer } from '../server.js'

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
