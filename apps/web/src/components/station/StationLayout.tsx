import { type ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthSession } from '../../features/auth/useAuthSession'
import { stationSectionTitleClassName, stationButtonClassName } from '../../pages/station/styles'

type StationLayoutProps = {
  children: ReactNode
}

export function StationLayout({ children }: StationLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const { disconnect, lastUpdatedAt, profile, refreshLastUpdatedAt } = useAuthSession()

  const navLinkClassName =
    'rounded-md border border-slate-300/20 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700/35 hover:text-sky-100'
  const activeNavLinkClassName = 'border-sky-300/40 bg-sky-500/20 text-sky-100'

  async function handleDisconnect() {
    const didDisconnect = await disconnect()
    if (didDisconnect) {
      navigate('/login')
    }
  }

  return (
    <section
      aria-label="Station page"
      className="box-border min-h-0 flex-1 w-full pb-5 pt-4 lg:pl-72 flex flex-col"
    >
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close station menu"
          className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-300/20 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-md transition-transform lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="pt-4">
          <section aria-label="Station status" className={`grid gap-2 p-4`}>
            <h1 className={stationSectionTitleClassName}>Station</h1>
            <div className="grid gap-1 text-sm text-slate-300">
              <p>Commander: {profile.displayName}</p>
              <p>Account: {profile.authType === 'guest' ? 'guest' : 'activated'}</p>
              <p>Last updated at: {lastUpdatedAt.toISOString()}</p>
            </div>
          </section>
        </div>
        <nav aria-label="Station navigation" className="grid gap-2 mt-4">
          <NavLink
            to="/station"
            end
            className={({ isActive }) =>
              `${navLinkClassName} ${isActive ? activeNavLinkClassName : ''}`
            }
            onClick={() => setIsSidebarOpen(false)}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/station/buildings"
            className={({ isActive }) =>
              `${navLinkClassName} ${isActive ? activeNavLinkClassName : ''}`
            }
            onClick={() => setIsSidebarOpen(false)}
          >
            Buildings
          </NavLink>
          <NavLink
            to="/station/factories"
            className={({ isActive }) =>
              `${navLinkClassName} ${isActive ? activeNavLinkClassName : ''}`
            }
            onClick={() => setIsSidebarOpen(false)}
          >
            Factories
          </NavLink>
          <NavLink
            to="/station/map"
            className={({ isActive }) =>
              `${navLinkClassName} ${isActive ? activeNavLinkClassName : ''}`
            }
            onClick={() => setIsSidebarOpen(false)}
          >
            Map
          </NavLink>
          <NavLink
            to="/station/account"
            className={({ isActive }) =>
              `${navLinkClassName} ${isActive ? activeNavLinkClassName : ''}`
            }
            onClick={() => setIsSidebarOpen(false)}
          >
            Account settings
          </NavLink>
        </nav>

        <div className="mt-auto flex gap-2">
          <button type="button" onClick={refreshLastUpdatedAt} className={stationButtonClassName}>
            Refresh station
          </button>
          <button type="button" onClick={handleDisconnect} className={stationButtonClassName}>
            Disconnect
          </button>
        </div>
      </aside>

      <div className="relative z-20 mb-4 lg:hidden">
        <button
          type="button"
          className="rounded-md border border-slate-300/30 px-3 py-2 text-sm text-slate-200"
          onClick={() => setIsSidebarOpen(true)}
        >
          Menu
        </button>
      </div>

      <div className="min-w-0 min-h-0 flex-1 flex flex-col overflow-hidden">{children}</div>
    </section>
  )
}
