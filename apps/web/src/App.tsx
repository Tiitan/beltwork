import type { SubmitEvent } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { AuthSessionProvider } from './features/auth/AuthSessionProvider'
import { useAuthSession } from './features/auth/useAuthSession'
import { hasStoredSession } from './hooks/useSessionProfileState'
import { StationProvider } from './features/station/StationProvider'
import { LoginPage } from './pages/LoginPage'
import { StationPage } from './pages/StationPage'

/**
 * Root web application shell and route composition.
 *
 * @returns App-level route tree and page layout container.
 */
function AppRoutes() {
  const navigate = useNavigate()
  const location = useLocation()
  const { startNowAsGuest, signIn } = useAuthSession()

  const screen = location.pathname.startsWith('/station') ? 'station' : 'login'
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
          path="/station/*"
          element={
            !sessionExists ? (
              <Navigate replace to="/login" />
            ) : (
              <StationProvider>
                <StationPage />
              </StationProvider>
            )
          }
        />
        <Route path="*" element={<Navigate replace to={sessionExists ? '/station' : '/login'} />} />
      </Routes>
    </main>
  )
}

function App() {
  return (
    <AuthSessionProvider>
      <AppRoutes />
    </AuthSessionProvider>
  )
}

export default App
