import { type ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthSession } from '../../features/auth/useAuthSession'
import {
  journalBannerTheme,
  journalNotificationCategoryLabel,
  useJournalNotifications,
} from '../../features/journal/JournalNotificationsProvider'
import { useStation } from '../../features/station/useStation'
import { stationSectionTitleClassName, stationButtonClassName } from '../../pages/styles'

type StationLayoutProps = {
  children: ReactNode
}

export function StationLayout({ children }: StationLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const { disconnect, lastUpdatedAt, profile, refreshLastUpdatedAt } = useAuthSession()
  const { isShellRefreshPending, refreshShellData } = useStation()
  const { notifications, dismissNotification } = useJournalNotifications()

  const navLinkClassName =
    'rounded-md border border-slate-300/20 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-700/35 hover:text-sky-100'
  const activeNavLinkClassName = 'border-sky-300/40 bg-sky-500/20 text-sky-100'

  async function handleDisconnect() {
    const didDisconnect = await disconnect()
    if (didDisconnect) {
      navigate('/login')
    }
  }

  async function handleRefreshStation() {
    const didRefresh = await refreshShellData()
    if (didRefresh) {
      refreshLastUpdatedAt()
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
            Station
          </NavLink>
          <NavLink
            to="/journal"
            className={({ isActive }) =>
              `${navLinkClassName} ${isActive ? activeNavLinkClassName : ''}`
            }
            onClick={() => setIsSidebarOpen(false)}
          >
            Journal
          </NavLink>
          <NavLink
            to="/map"
            className={({ isActive }) =>
              `${navLinkClassName} ${isActive ? activeNavLinkClassName : ''}`
            }
            onClick={() => setIsSidebarOpen(false)}
          >
            Map
          </NavLink>
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `${navLinkClassName} ${isActive ? activeNavLinkClassName : ''}`
            }
            onClick={() => setIsSidebarOpen(false)}
          >
            Account settings
          </NavLink>
        </nav>

        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={handleRefreshStation}
            disabled={isShellRefreshPending}
            className={`${stationButtonClassName} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {isShellRefreshPending ? 'Refreshing...' : 'Refresh station'}
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

      <div className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col items-center gap-3 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[26rem]">
        {notifications.map((notification) => {
          const theme = journalBannerTheme(notification.importance)
          return (
            <section
              key={notification.id}
              aria-label="Completion banner"
              className={`pointer-events-auto w-full overflow-hidden rounded-2xl border ${theme.card} shadow-[0_24px_50px_rgba(0,0,0,0.4)] animate-[banner-pop-in_180ms_ease-out]`}
            >
              <div className="flex gap-4 px-4 py-3.5">
                <div className={`mt-1 h-12 w-1 shrink-0 rounded-full ${theme.accent}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] ${theme.badge}`}
                    >
                      {journalNotificationCategoryLabel(notification.eventType)}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Completion registered
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-100">
                    {notification.description}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Dismiss notification: ${notification.description}`}
                  onClick={() => {
                    dismissNotification(notification.id)
                  }}
                  className="shrink-0 rounded-full border border-slate-300/12 bg-slate-950/35 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-slate-800/60"
                >
                  Dismiss
                </button>
              </div>
            </section>
          )
        })}
      </div>

      <div className="min-w-0 min-h-0 flex-1 flex flex-col overflow-hidden">{children}</div>
    </section>
  )
}
