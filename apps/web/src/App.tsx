import { type FormEvent, useEffect, useMemo, useState } from 'react'
import './App.css'
import { LoginPage } from './pages/LoginPage'
import { StationPage } from './pages/StationPage'

type AppScreen = 'login' | 'station'

type InventoryRow = {
  resourceKey: string
  amount: number
}

type BuildingRow = {
  type: string
  level: number
  status: 'idle' | 'upgrading'
}

type AsteroidRow = {
  id: string
  templateId: string
  distanceFromStation: number
  remainingUnits: number
  isDepleted: boolean
}

type SessionType = 'guest' | 'local'

type Profile = {
  authType: SessionType
  displayName: string
  email: string
  password: string
}

const initialInventory: InventoryRow[] = [
  { resourceKey: 'res_metals', amount: 120 },
  { resourceKey: 'res_carbon', amount: 45 },
  { resourceKey: 'cmp_metal_plates', amount: 12 },
]

const initialBuildings: BuildingRow[] = [
  { type: 'fusion_reactor', level: 1, status: 'idle' },
  { type: 'refinery', level: 1, status: 'upgrading' },
  { type: 'assembler', level: 1, status: 'idle' },
]

const discoveredAsteroids: AsteroidRow[] = [
  {
    id: 'ast-101',
    templateId: 'ast_common_chondrite',
    distanceFromStation: 18,
    remainingUnits: 950,
    isDepleted: false,
  },
  {
    id: 'ast-202',
    templateId: 'ast_metal_rich',
    distanceFromStation: 41,
    remainingUnits: 510,
    isDepleted: false,
  },
]

const SESSION_STORAGE_KEY = 'beltwork_session_type'
const PROFILE_STORAGE_KEY = 'beltwork_profile'
const placeholderAssets = {
  loginBackground: 'bg_login_nebula_placeholder.png',
  stationBackground: 'bg_station_observation_deck_placeholder.png',
  loginIllustration: 'chr_guest_pilot_placeholder.png',
  stationBackdrop: 'env_station_hab_ring_placeholder.png',
  panelTexture: 'ui_panel_brushed_titanium_placeholder.png',
}

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

function hasSession(): boolean {
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

function getScreenFromPath(pathname: string): AppScreen {
  if (pathname === '/station') {
    return 'station'
  }

  return 'login'
}

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [profile, setProfile] = useState<Profile>(() => readProfile())
  const [settingsForm, setSettingsForm] = useState(() => {
    const initialProfile = readProfile()
    return {
      displayName: initialProfile.displayName,
      email: initialProfile.email,
      password: initialProfile.password,
    }
  })
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date())
  const [selectedAsteroidId, setSelectedAsteroidId] = useState(discoveredAsteroids[0]?.id ?? '')
  const [selectedRecipeKey, setSelectedRecipeKey] = useState('rcp_refine_metal_plates')
  const [inventory] = useState(initialInventory)
  const [buildings] = useState(initialBuildings)

  const screen = getScreenFromPath(pathname)

  const selectedAsteroid = useMemo(
    () => discoveredAsteroids.find((asteroid) => asteroid.id === selectedAsteroidId),
    [selectedAsteroidId],
  )

  useEffect(() => {
    function onPopState() {
      setPathname(window.location.pathname)
    }

    if (window.location.pathname === '/') {
      const landingPath = hasSession() ? '/station' : '/login'
      window.history.replaceState(null, '', landingPath)
      setPathname(landingPath)
    }

    if (window.location.pathname === '/station' && !hasSession()) {
      window.history.replaceState(null, '', '/login')
      setPathname('/login')
    }

    if (window.location.pathname === '/login' && hasSession()) {
      window.history.replaceState(null, '', '/station')
      setPathname('/station')
    }

    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  function navigate(path: string) {
    window.history.pushState(null, '', path)
    setPathname(path)
  }

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
    navigate('/station')
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextProfile: Profile = {
      ...profile,
      authType: 'local',
    }
    writeProfile(nextProfile)
    setProfile(nextProfile)
    writeSession('local')
    setLastUpdatedAt(new Date())
    navigate('/station')
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
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

  function disconnect() {
    const sessionType = readSessionType()

    if (sessionType === 'guest') {
      const confirmed = window.confirm(
        'You are using a guest session. Disconnecting now will delete this guest progress. Activate your account with email and password before disconnecting if you want to keep your save. Disconnect anyway?',
      )
      if (!confirmed) {
        return
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
    navigate('/login')
  }

  function refreshStation() {
    setLastUpdatedAt(new Date())
  }

  return (
    <main className={`app-shell ${screen === 'login' ? 'app-shell-login' : 'app-shell-station'}`}>
      {screen === 'login' ? (
        <LoginPage
          placeholderAssets={placeholderAssets}
          onSignIn={signIn}
          onStartNow={startNowAsGuest}
        />
      ) : (
        <StationPage
          accountStatus={profile.authType}
          buildings={buildings}
          discoveredAsteroids={discoveredAsteroids}
          displayName={profile.displayName}
          inventory={inventory}
          lastUpdatedAt={lastUpdatedAt}
          placeholderAssets={placeholderAssets}
          settingsForm={settingsForm}
          selectedAsteroid={selectedAsteroid}
          selectedAsteroidId={selectedAsteroidId}
          selectedRecipeKey={selectedRecipeKey}
          onDisconnect={disconnect}
          onRefreshStation={refreshStation}
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
      )}
    </main>
  )
}

export default App
