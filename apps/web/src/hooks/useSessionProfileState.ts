import { type SubmitEvent, useState } from 'react'
import type { Profile, SessionType, SettingsForm } from '../types/app'

const SESSION_STORAGE_KEY = 'beltwork_session_type'
const PROFILE_STORAGE_KEY = 'beltwork_profile'

function getDefaultGuestProfile(): Profile {
  return {
    authType: 'guest',
    displayName: 'Calm Prospector 0421',
    email: '',
    password: '',
  }
}

function readSessionType(): SessionType | null {
  const value = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (value === 'guest' || value === 'local') {
    return value
  }

  return null
}

export function hasStoredSession(): boolean {
  return readSessionType() !== null
}

function writeSession(sessionType: SessionType) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionType)
}

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

function writeProfile(profile: Profile) {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
}

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
