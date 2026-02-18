import type { ReactNode, SubmitEvent } from 'react'
import { createContext, useMemo } from 'react'
import { useSessionProfileState } from '../../hooks/useSessionProfileState'
import type { Profile, SettingsForm } from '../../types/app'

type AuthSessionContextValue = {
  hasSession: boolean
  isBootstrapping: boolean
  profile: Profile
  settingsForm: SettingsForm
  lastUpdatedAt: Date
  startNowAsGuest: () => Promise<boolean>
  signIn: (event: SubmitEvent<HTMLFormElement>) => Promise<boolean>
  signInWithGoogleToken: (idToken: string) => Promise<boolean>
  saveSettings: (event: SubmitEvent<HTMLFormElement>) => Promise<boolean>
  disconnect: () => Promise<boolean>
  linkCurrentAccountWithGoogle: (idToken: string) => Promise<boolean>
  refreshLastUpdatedAt: () => void
  setSettingsDisplayName: (value: string) => void
  setSettingsEmail: (value: string) => void
  setSettingsPassword: (value: string) => void
}

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null)

type AuthSessionProviderProps = {
  children: ReactNode
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  const sessionState = useSessionProfileState()

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      hasSession: sessionState.hasSession,
      isBootstrapping: sessionState.isBootstrapping,
      profile: sessionState.profile,
      settingsForm: sessionState.settingsForm,
      lastUpdatedAt: sessionState.lastUpdatedAt,
      startNowAsGuest: sessionState.startNowAsGuest,
      signIn: sessionState.signIn,
      signInWithGoogleToken: sessionState.signInWithGoogleToken,
      saveSettings: sessionState.saveSettings,
      disconnect: sessionState.disconnect,
      linkCurrentAccountWithGoogle: sessionState.linkCurrentAccountWithGoogle,
      refreshLastUpdatedAt: sessionState.refreshLastUpdatedAt,
      setSettingsDisplayName: (nextDisplayName: string) =>
        sessionState.setSettingsForm((current) => ({ ...current, displayName: nextDisplayName })),
      setSettingsEmail: (nextEmail: string) =>
        sessionState.setSettingsForm((current) => ({ ...current, email: nextEmail })),
      setSettingsPassword: (nextPassword: string) =>
        sessionState.setSettingsForm((current) => ({ ...current, password: nextPassword })),
    }),
    [sessionState],
  )

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}
