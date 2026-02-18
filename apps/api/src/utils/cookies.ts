import { createHmac, timingSafeEqual } from 'node:crypto'
import type { env } from '../config.js'

type CookieEnv = Pick<typeof env, 'NODE_ENV' | 'SESSION_COOKIE_NAME' | 'SESSION_COOKIE_SECRET'>

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {}
  }

  const cookies: Record<string, string> = {}
  for (const cookiePart of cookieHeader.split(';')) {
    const [rawKey, ...rawValueParts] = cookiePart.trim().split('=')
    if (!rawKey || rawValueParts.length === 0) {
      continue
    }

    cookies[decodeURIComponent(rawKey)] = decodeURIComponent(rawValueParts.join('='))
  }

  return cookies
}

export function signSessionToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('base64url')
}

export function encodeSignedSessionCookieValue(token: string, secret: string): string {
  return `${token}.${signSessionToken(token, secret)}`
}

export function decodeAndVerifySignedSessionCookieValue(
  rawValue: string | undefined,
  secret: string,
): string | null {
  if (!rawValue) {
    return null
  }

  const delimiterIndex = rawValue.lastIndexOf('.')
  if (delimiterIndex <= 0 || delimiterIndex >= rawValue.length - 1) {
    return null
  }

  const token = rawValue.slice(0, delimiterIndex)
  const signature = rawValue.slice(delimiterIndex + 1)
  const expectedSignature = signSessionToken(token, secret)

  const expectedBuffer = Buffer.from(expectedSignature)
  const receivedBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== receivedBuffer.length) {
    return null
  }

  if (!timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return null
  }

  return token
}

function isSecureCookie(mode: CookieEnv['NODE_ENV']): boolean {
  return mode === 'production'
}

export function serializeSessionCookie(token: string, cookieEnv: CookieEnv): string {
  const cookieValue = encodeSignedSessionCookieValue(token, cookieEnv.SESSION_COOKIE_SECRET)
  const attributes = [
    `${encodeURIComponent(cookieEnv.SESSION_COOKIE_NAME)}=${encodeURIComponent(cookieValue)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=2592000',
  ]

  if (isSecureCookie(cookieEnv.NODE_ENV)) {
    attributes.push('Secure')
  }

  return attributes.join('; ')
}

export function serializeExpiredSessionCookie(cookieEnv: CookieEnv): string {
  const attributes = [
    `${encodeURIComponent(cookieEnv.SESSION_COOKIE_NAME)}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
  ]

  if (isSecureCookie(cookieEnv.NODE_ENV)) {
    attributes.push('Secure')
  }

  return attributes.join('; ')
}
