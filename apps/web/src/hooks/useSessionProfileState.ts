import { type SubmitEvent, useState } from 'react'
import type { Profile, SessionType, SettingsForm } from '../types/app'

/**
 * Local storage key for persisted session type.
 */
const SESSION_STORAGE_KEY = 'beltwork_session_type'
/**
 * Local storage key for persisted profile payload.
 */
const PROFILE_STORAGE_KEY = 'beltwork_profile'

/**
 * Builds the default guest profile used when no profile exists.
 */
function getDefaultGuestProfile(): Profile {
  return {
    authType: 'guest',
    displayName: 'Calm Prospector 0421',
    email: '',
    password: '',
  }
}

/**
 * Reads and validates the persisted session type from local storage.
 */
function readSessionType(): SessionType | null {
  const value = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (value === 'guest' || value === 'local') {
    return value
  }

  return null
}

/**
 * Returns whether a valid persisted session currently exists.
 *
 * @returns `true` when local storage contains a supported session type.
 */
export function hasStoredSession(): boolean {
  return readSessionType() !== null
}

/**
 * Persists the current session type.
 */
function writeSession(sessionType: SessionType) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionType)
}

/**
 * Reads and normalizes the persisted profile payload.
 */
function readProfile(): Profile {
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY)
  if (!raw) {
    return getDefaultGuestProfile()
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Profile>
    return {
      authType: parsed.authType === 'local' ? 'local' : 'guest',
      displayName:
        typeof parsed.displayName === 'string' && parsed.displayName.trim().length > 0
          ? parsed.displayName
          : getDefaultGuestProfile().displayName,
      email: typeof parsed.email === 'string' ? parsed.email : '',
      password: typeof parsed.password === 'string' ? parsed.password : '',
    }
  } catch {
    return getDefaultGuestProfile()
  }
}

/**
 * Persists the full profile object.
 */
function writeProfile(profile: Profile) {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
}

/**
 * Manages profile/session state and account actions for the web app.
 *
 * @returns Profile state, settings form state, and auth/session action handlers.
 */
export function useSessionProfileState() {
  const [profile, setProfile] = useState<Profile>(() => readProfile())
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(() => {
    const initialProfile = readProfile()
    return {
      displayName: initialProfile.displayName,
      email: initialProfile.email,
      password: initialProfile.password,
    }
  })
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date())

  /**
   * Starts a fresh guest session and resets profile-bound form values.
   */
  function startNowAsGuest() {
    const guestProfile = getDefaultGuestProfile()
    writeProfile(guestProfile)
    setProfile(guestProfile)
    setSettingsForm({
      displayName: guestProfile.displayName,
      email: guestProfile.email,
      password: guestProfile.password,
    })
    writeSession('guest')
    setLastUpdatedAt(new Date())
  }

  /**
   * Converts the current profile to a local account session.
   *
   * @param event Form submit event from login submission.
   */
  function signIn(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextProfile: Profile = {
      ...profile,
      authType: 'local',
    }
    writeProfile(nextProfile)
    setProfile(nextProfile)
    writeSession('local')
    setLastUpdatedAt(new Date())
  }

  /**
   * Saves account settings and upgrades auth type when credentials are provided.
   *
   * @param event Form submit event from settings form submission.
   */
  function saveSettings(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedDisplayName = settingsForm.displayName.trim()
    const normalizedEmail = settingsForm.email.trim()
    const normalizedPassword = settingsForm.password

    const activatedAccount = normalizedEmail.length > 0 && normalizedPassword.length > 0

    const nextProfile: Profile = {
      authType: activatedAccount ? 'local' : profile.authType,
      displayName: normalizedDisplayName.length > 0 ? normalizedDisplayName : profile.displayName,
      email: normalizedEmail,
      password: normalizedPassword,
    }

    setProfile(nextProfile)
    writeProfile(nextProfile)

    if (activatedAccount) {
      writeSession('local')
    }
  }

  /**
   * Clears the active session and optionally resets guest profile data.
   *
   * @returns `true` when disconnection is completed, `false` when cancelled.
   */
  function disconnect(): boolean {
    const sessionType = readSessionType()

    if (sessionType === 'guest') {
      const confirmed = window.confirm(
        'You are using a guest session. Disconnecting now will delete this guest progress. Activate your account with email and password before disconnecting if you want to keep your save. Disconnect anyway?',
      )
      if (!confirmed) {
        return false
      }

      window.localStorage.removeItem(PROFILE_STORAGE_KEY)
      const guestProfile = getDefaultGuestProfile()
      setProfile(guestProfile)
      setSettingsForm({
        displayName: guestProfile.displayName,
        email: guestProfile.email,
        password: guestProfile.password,
      })
    }

    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    return true
  }

  /**
   * Updates the station freshness timestamp.
   */
  function refreshLastUpdatedAt() {
    setLastUpdatedAt(new Date())
  }

  return {
    profile,
    settingsForm,
    lastUpdatedAt,
    setSettingsForm,
    startNowAsGuest,
    signIn,
    saveSettings,
    disconnect,
    refreshLastUpdatedAt,
  }
}
