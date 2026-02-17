import type { SubmitEvent } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { useSessionProfileState, hasStoredSession } from './hooks/useSessionProfileState'
import { useStationState } from './hooks/useStationState'
import { LoginPage } from './pages/LoginPage'
import { StationPage } from './pages/StationPage'

/**
 * Root web application shell and route composition.
 *
 * @returns App-level route tree and page layout container.
 */
function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    profile,
    settingsForm,
    lastUpdatedAt,
    setSettingsForm,
    startNowAsGuest,
    signIn,
    saveSettings,
    disconnect,
    refreshLastUpdatedAt,
  } = useSessionProfileState()
  const {
    inventory,
    buildings,
    discoveredAsteroids,
    selectedAsteroid,
    selectedAsteroidId,
    selectedRecipeKey,
    setSelectedAsteroidId,
    setSelectedRecipeKey,
  } = useStationState()

  const screen = location.pathname === '/station' ? 'station' : 'login'
  const sessionExists = hasStoredSession()

  /**
   * Starts a guest session and routes to station view.
   */
  function handleStartNowAsGuest() {
    startNowAsGuest()
    navigate('/station')
  }

  /**
   * Handles login form submission and routes to station view.
   *
   * @param event Login form submit event.
   */
  function handleSignIn(event: SubmitEvent<HTMLFormElement>) {
    signIn(event)
    navigate('/station')
  }

  /**
   * Disconnects the active session and routes to login when confirmed.
   */
  function handleDisconnect() {
    const didDisconnect = disconnect()
    if (didDisconnect) {
      navigate('/login')
    }
  }

  /**
   * Updates editable display name in settings form state.
   *
   * @param value Next display name value from form input.
   */
  function handleSettingsDisplayNameChange(value: string) {
    setSettingsForm((current) => ({ ...current, displayName: value }))
  }

  /**
   * Updates editable email in settings form state.
   *
   * @param value Next email value from form input.
   */
  function handleSettingsEmailChange(value: string) {
    setSettingsForm((current) => ({ ...current, email: value }))
  }

  /**
   * Updates editable password in settings form state.
   *
   * @param value Next password value from form input.
   */
  function handleSettingsPasswordChange(value: string) {
    setSettingsForm((current) => ({ ...current, password: value }))
  }

  return (
    <main
      className={`min-h-screen bg-slate-950 bg-cover bg-center bg-no-repeat p-5 text-slate-100 max-[740px]:p-3 ${screen === 'login' ? 'bw-bg-login' : 'bw-bg-station'}`}
    >
      <Routes>
        <Route path="/" element={<Navigate replace to={sessionExists ? '/station' : '/login'} />} />
        <Route
          path="/login"
          element={
            sessionExists ? (
              <Navigate replace to="/station" />
            ) : (
              <LoginPage onSignIn={handleSignIn} onStartNow={handleStartNowAsGuest} />
            )
          }
        />
        <Route
          path="/station"
          element={
            !sessionExists ? (
              <Navigate replace to="/login" />
            ) : (
              <StationPage
                accountStatus={profile.authType}
                buildings={buildings}
                discoveredAsteroids={discoveredAsteroids}
                displayName={profile.displayName}
                inventory={inventory}
                lastUpdatedAt={lastUpdatedAt}
                settingsForm={settingsForm}
                selectedAsteroid={selectedAsteroid}
                selectedAsteroidId={selectedAsteroidId}
                selectedRecipeKey={selectedRecipeKey}
                onDisconnect={handleDisconnect}
                onRefreshStation={refreshLastUpdatedAt}
                onSaveSettings={saveSettings}
                onSettingsDisplayNameChange={handleSettingsDisplayNameChange}
                onSettingsEmailChange={handleSettingsEmailChange}
                onSettingsPasswordChange={handleSettingsPasswordChange}
                onSelectedAsteroidChange={setSelectedAsteroidId}
                onSelectedRecipeChange={setSelectedRecipeKey}
              />
            )
          }
        />
        <Route path="*" element={<Navigate replace to={sessionExists ? '/station' : '/login'} />} />
      </Routes>
    </main>
  )
}

export default App
