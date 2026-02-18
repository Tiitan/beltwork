import { describe, expect, it } from 'vitest'
import {
  decodeAndVerifySignedSessionCookieValue,
  encodeSignedSessionCookieValue,
  parseCookies,
} from './cookies.js'

describe('cookies utils', () => {
  it('parses cookie header pairs', () => {
    const parsed = parseCookies('foo=bar; answer=42')
    expect(parsed).toEqual({ foo: 'bar', answer: '42' })
  })

  it('verifies signed session token and rejects tampered values', () => {
    const secret = 'secret-123'
    const signed = encodeSignedSessionCookieValue('token-abc', secret)

    expect(decodeAndVerifySignedSessionCookieValue(signed, secret)).toBe('token-abc')
    expect(decodeAndVerifySignedSessionCookieValue(`${signed}tampered`, secret)).toBeNull()
  })
})
