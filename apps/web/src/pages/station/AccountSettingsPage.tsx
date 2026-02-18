import { useCallback, useState } from 'react'
import { GoogleSignInButton } from '../../features/auth/GoogleSignInButton'
import { useAuthSession } from '../../features/auth/useAuthSession'
import {
  stationButtonClassName,
  stationFieldClassName,
  stationLabelClassName,
  stationSectionTitleClassName,
  stationSectionWrapperClassName,
} from './styles'

export function AccountSettingsPage() {
  const {
    linkCurrentAccountWithGoogle,
    profile,
    saveSettings,
    setSettingsDisplayName,
    setSettingsEmail,
    setSettingsPassword,
    settingsForm,
  } = useAuthSession()
  const [googleMessage, setGoogleMessage] = useState<string | null>(null)

  const handleGoogleLink = useCallback(
    async (idToken: string) => {
      try {
        await linkCurrentAccountWithGoogle(idToken)
        setGoogleMessage('Google account linked successfully.')
      } catch (error) {
        if (error instanceof Error && error.message === 'google_identity_in_use') {
          setGoogleMessage('This Google account is already linked to another profile.')
          return
        }

        setGoogleMessage('Failed to link Google account. Please try again.')
      }
    },
    [linkCurrentAccountWithGoogle],
  )

  const handleGoogleLinkError = useCallback((message: string) => {
    if (message === 'missing_google_client_id') {
      return
    }

    setGoogleMessage('Failed to initialize Google sign-in.')
  }, [])

  return (
    <section aria-label="Account settings page" className={stationSectionWrapperClassName}>
      <h2 className={stationSectionTitleClassName}>Account settings</h2>
      <p>Set email, password, and display name.</p>
      <form onSubmit={saveSettings} className="grid gap-2">
        <label htmlFor="settings-display-name" className={stationLabelClassName}>
          Display name
        </label>
        <input
          id="settings-display-name"
          type="text"
          value={settingsForm.displayName}
          onChange={(event) => setSettingsDisplayName(event.target.value)}
          className={stationFieldClassName}
        />

        <label htmlFor="settings-email" className={stationLabelClassName}>
          Email
        </label>
        <input
          id="settings-email"
          type="email"
          value={settingsForm.email}
          onChange={(event) => setSettingsEmail(event.target.value)}
          className={stationFieldClassName}
        />

        <label htmlFor="settings-password" className={stationLabelClassName}>
          Password
        </label>
        <input
          id="settings-password"
          type="password"
          value={settingsForm.password}
          onChange={(event) => setSettingsPassword(event.target.value)}
          className={stationFieldClassName}
        />

        <button type="submit" className={stationButtonClassName}>
          Save settings
        </button>
      </form>

      <div className="mt-4 grid gap-2">
        {profile.googleLinked ? (
          <p className={stationLabelClassName}>
            Google Sign-In linked to: "{profile.googleLinkedEmail}"
          </p>
        ) : (
          <>
            <p className={stationLabelClassName}>Google Sign-In (not linked)</p>
            <GoogleSignInButton
              mode="link"
              onSuccess={handleGoogleLink}
              onError={handleGoogleLinkError}
            />
          </>
        )}
        {googleMessage ? <p className="text-sm text-slate-300">{googleMessage}</p> : null}
      </div>
    </section>
  )
}
