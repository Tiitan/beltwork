export type SessionType = 'guest' | 'local' | 'google'

export type AuthProfile = {
  id: string
  display_name: string
  auth_type: SessionType
  email: string
  google_linked: boolean
  google_linked_email: string
}

type AuthenticatedResponse = {
  authenticated: true
  profile: AuthProfile
}

type UnauthenticatedResponse = {
  authenticated: false
}

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (typeof init.body !== 'undefined' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  return fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })
}

export async function bootstrapSession(): Promise<AuthenticatedResponse | UnauthenticatedResponse> {
  const response = await apiFetch('/v1/session/bootstrap', { method: 'GET' })
  if (!response.ok) {
    return { authenticated: false }
  }

  return (await response.json()) as AuthenticatedResponse | UnauthenticatedResponse
}

export async function startNowAsGuest(): Promise<AuthenticatedResponse> {
  const response = await apiFetch('/v1/session/start-now', { method: 'POST' })
  if (!response.ok) {
    throw new Error('failed_to_start_guest_session')
  }

  return (await response.json()) as AuthenticatedResponse
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<AuthenticatedResponse> {
  const response = await apiFetch('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error('invalid_credentials')
  }

  return (await response.json()) as AuthenticatedResponse
}

export async function saveAccountSettings(payload: {
  display_name: string
  email?: string
  password?: string
}): Promise<AuthenticatedResponse> {
  const response = await apiFetch('/v1/settings/account', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('failed_to_save_account_settings')
  }

  return (await response.json()) as AuthenticatedResponse
}

export async function logoutSession(): Promise<void> {
  await apiFetch('/v1/session/logout', { method: 'POST' })
}

export async function signInWithGoogle(idToken: string): Promise<AuthenticatedResponse> {
  const response = await apiFetch('/v1/auth/google', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken }),
  })

  if (!response.ok) {
    throw new Error('invalid_google_token')
  }

  return (await response.json()) as AuthenticatedResponse
}

export async function linkGoogleAccount(idToken: string): Promise<AuthenticatedResponse> {
  const response = await apiFetch('/v1/settings/account/google-link', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? 'failed_to_link_google_account')
  }

  return (await response.json()) as AuthenticatedResponse
}
