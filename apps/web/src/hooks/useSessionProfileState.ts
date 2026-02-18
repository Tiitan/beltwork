import { type SubmitEvent, useEffect, useState } from 'react'
import {
  bootstrapSession,
  linkGoogleAccount,
  logoutSession,
  saveAccountSettings,
  signInWithEmailPassword,
  signInWithGoogle,
  startNowAsGuest as startNowAsGuestApi,
  type AuthProfile,
} from '../features/auth/api'
import type { Profile, SettingsForm } from '../types/app'

function getDefaultGuestProfile(): Profile {
  return {
    id: '',
    authType: 'guest',
    displayName: 'Calm Prospector 0421',
    email: '',
    googleLinked: false,
    googleLinkedEmail: '',
  }
}

function toProfile(authProfile: AuthProfile): Profile {
  return {
    id: authProfile.id,
    authType: authProfile.auth_type,
    displayName: authProfile.display_name,
    email: authProfile.email,
    googleLinked: authProfile.google_linked,
    googleLinkedEmail: authProfile.google_linked_email,
  }
}

export function useSessionProfileState() {
  const [hasSession, setHasSession] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [profile, setProfile] = useState<Profile>(getDefaultGuestProfile)
  const [settingsForm, setSettingsForm] = useState<SettingsForm>({
    displayName: '',
    email: '',
    password: '',
  })
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date())

  useEffect(() => {
    let isMounted = true

    async function loadSession() {
      try {
        const response = await bootstrapSession()
        if (!isMounted) {
          return
        }

        if (!response.authenticated) {
          setHasSession(false)
          setProfile(getDefaultGuestProfile())
          setSettingsForm({
            displayName: '',
            email: '',
            password: '',
          })
          return
        }

        const nextProfile = toProfile(response.profile)
        setHasSession(true)
        setProfile(nextProfile)
        setSettingsForm({
          displayName: nextProfile.displayName,
          email: nextProfile.email,
          password: '',
        })
      } finally {
        if (isMounted) {
          setIsBootstrapping(false)
        }
      }
    }

    void loadSession()

    return () => {
      isMounted = false
    }
  }, [])

  async function startNowAsGuest(): Promise<boolean> {
    const response = await startNowAsGuestApi()
    const nextProfile = toProfile(response.profile)

    setHasSession(true)
    setProfile(nextProfile)
    setSettingsForm({
      displayName: nextProfile.displayName,
      email: nextProfile.email,
      password: '',
    })
    setLastUpdatedAt(new Date())

    return true
  }

  async function signIn(event: SubmitEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    if (email.length === 0 || password.length === 0) {
      return false
    }

    const response = await signInWithEmailPassword(email, password)
    const nextProfile = toProfile(response.profile)

    setHasSession(true)
    setProfile(nextProfile)
    setSettingsForm({
      displayName: nextProfile.displayName,
      email: nextProfile.email,
      password: '',
    })
    setLastUpdatedAt(new Date())

    return true
  }

  async function signInWithGoogleToken(idToken: string): Promise<boolean> {
    const response = await signInWithGoogle(idToken)
    const nextProfile = toProfile(response.profile)

    setHasSession(true)
    setProfile(nextProfile)
    setSettingsForm({
      displayName: nextProfile.displayName,
      email: nextProfile.email,
      password: '',
    })
    setLastUpdatedAt(new Date())

    return true
  }

  async function saveSettings(event: SubmitEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault()

    const normalizedDisplayName = settingsForm.displayName.trim()
    const normalizedEmail = settingsForm.email.trim()
    const normalizedPassword = settingsForm.password

    const response = await saveAccountSettings({
      display_name: normalizedDisplayName.length > 0 ? normalizedDisplayName : profile.displayName,
      ...(normalizedEmail.length > 0 && normalizedPassword.length > 0
        ? {
            email: normalizedEmail,
            password: normalizedPassword,
          }
        : {}),
    })

    const nextProfile = toProfile(response.profile)
    setProfile(nextProfile)
    setSettingsForm({
      displayName: nextProfile.displayName,
      email: nextProfile.email,
      password: '',
    })
    setLastUpdatedAt(new Date())

    return true
  }

  async function disconnect(): Promise<boolean> {
    if (profile.authType === 'guest') {
      const confirmed = window.confirm(
        'You are using a guest session. Disconnecting now will delete this guest progress. Activate your account with email and password before disconnecting if you want to keep your save. Disconnect anyway?',
      )
      if (!confirmed) {
        return false
      }
    }

    await logoutSession()

    setHasSession(false)
    setProfile(getDefaultGuestProfile())
    setSettingsForm({
      displayName: '',
      email: '',
      password: '',
    })

    return true
  }

  async function linkCurrentAccountWithGoogle(idToken: string): Promise<boolean> {
    const response = await linkGoogleAccount(idToken)
    const nextProfile = toProfile(response.profile)
    setProfile(nextProfile)
    setSettingsForm({
      displayName: nextProfile.displayName,
      email: nextProfile.email,
      password: '',
    })
    setLastUpdatedAt(new Date())
    return true
  }

  function refreshLastUpdatedAt() {
    setLastUpdatedAt(new Date())
  }

  return {
    hasSession,
    isBootstrapping,
    profile,
    settingsForm,
    lastUpdatedAt,
    setSettingsForm,
    startNowAsGuest,
    signIn,
    signInWithGoogleToken,
    saveSettings,
    disconnect,
    linkCurrentAccountWithGoogle,
    refreshLastUpdatedAt,
  }
}
