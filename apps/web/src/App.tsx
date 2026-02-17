import type { SubmitEvent } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { useSessionProfileState, hasStoredSession } from './hooks/useSessionProfileState'
import { useStationState } from './hooks/useStationState'
import { LoginPage } from './pages/LoginPage'
import { StationPage } from './pages/StationPage'

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

  function handleStartNowAsGuest() {
    startNowAsGuest()
    navigate('/station')
  }

  function handleSignIn(event: SubmitEvent<HTMLFormElement>) {
    signIn(event)
    navigate('/station')
  }

  function handleDisconnect() {
    const didDisconnect = disconnect()
    if (didDisconnect) {
      navigate('/login')
    }
  }

  return (
    <main className={`app-shell ${screen === 'login' ? 'app-shell-login' : 'app-shell-station'}`}>
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
                onSettingsDisplayNameChange={(value) =>
                  setSettingsForm((current) => ({ ...current, displayName: value }))
                }
                onSettingsEmailChange={(value) =>
                  setSettingsForm((current) => ({ ...current, email: value }))
                }
                onSettingsPasswordChange={(value) =>
                  setSettingsForm((current) => ({ ...current, password: value }))
                }
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
