import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { env } from '../config.js'
import type { GoogleIdentityClaims, VerifyGoogleIdToken } from '../types/api.js'

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function parseEmailVerifiedClaim(payload: JWTPayload): boolean {
  if (payload.email_verified === true) {
    return true
  }

  if (payload.email_verified === 'true') {
    return true
  }

  return false
}

export function createDefaultVerifyGoogleIdToken(
  googleEnv: Pick<typeof env, 'GOOGLE_ALLOWED_ISSUERS' | 'GOOGLE_CLIENT_ID'>,
): VerifyGoogleIdToken {
  return async function defaultVerifyGoogleIdToken(idToken: string): Promise<GoogleIdentityClaims> {
    if (!googleEnv.GOOGLE_CLIENT_ID) {
      throw new Error('google_client_id_not_configured')
    }

    const allowedIssuers = googleEnv.GOOGLE_ALLOWED_ISSUERS.split(',')
      .map((issuer) => issuer.trim())
      .filter((issuer) => issuer.length > 0)

    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      audience: googleEnv.GOOGLE_CLIENT_ID,
      issuer: allowedIssuers,
    })

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('invalid_google_sub')
    }

    if (typeof payload.email !== 'string' || payload.email.length === 0) {
      throw new Error('invalid_google_email')
    }

    const emailVerified = parseEmailVerifiedClaim(payload)
    if (!emailVerified) {
      throw new Error('google_email_not_verified')
    }

    return {
      sub: payload.sub,
      email: normalizeEmail(payload.email),
      name:
        typeof payload.name === 'string' && payload.name.trim().length > 0
          ? payload.name
          : 'Google Pilot',
      emailVerified,
    }
  }
}
