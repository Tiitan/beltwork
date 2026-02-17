import type { ReactNode, SubmitEvent } from 'react'
import { createContext, useMemo } from 'react'
import { hasStoredSession, useSessionProfileState } from '../../hooks/useSessionProfileState'
import type { Profile, SettingsForm } from '../../types/app'

type AuthSessionContextValue = {
  hasSession: boolean
  profile: Profile
  settingsForm: SettingsForm
  lastUpdatedAt: Date
  startNowAsGuest: () => void
  signIn: (event: SubmitEvent<HTMLFormElement>) => void
  saveSettings: (event: SubmitEvent<HTMLFormElement>) => void
  disconnect: () => boolean
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
      hasSession: hasStoredSession(),
      profile: sessionState.profile,
      settingsForm: sessionState.settingsForm,
      lastUpdatedAt: sessionState.lastUpdatedAt,
      startNowAsGuest: sessionState.startNowAsGuest,
      signIn: sessionState.signIn,
      saveSettings: sessionState.saveSettings,
      disconnect: sessionState.disconnect,
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
