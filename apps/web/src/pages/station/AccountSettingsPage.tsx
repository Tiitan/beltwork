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
    saveSettings,
    setSettingsDisplayName,
    setSettingsEmail,
    setSettingsPassword,
    settingsForm,
  } = useAuthSession()

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
    </section>
  )
}
