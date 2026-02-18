import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './passwords.js'

describe('password utils', () => {
  it('hashes and verifies valid password', async () => {
    const hash = await hashPassword('my-password')
    expect(await verifyPassword('my-password', hash)).toBe(true)
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('rejects invalid hash format', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false)
  })
})
