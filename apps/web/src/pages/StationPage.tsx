import { Route, Routes } from 'react-router-dom'
import { StationHomePage } from './station/StationHomePage'

function StationRouteNotFound() {
  return (
    <section
      aria-label="Station page not found"
      className="m-4 rounded-xl border border-slate-300/20 bg-slate-950/70 p-4 text-sm text-slate-200"
    >
      <h2 className="m-0 text-lg text-sky-100">Station page not found</h2>
      <p className="mb-0 mt-2">The requested station section does not exist.</p>
    </section>
  )
}

/**
 * Renders station layout and station subpages.
 *
 * @returns Station route surface.
 */
export function StationPage() {
  return (
    <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
      <Routes>
        <Route index element={<StationHomePage />} />
        <Route path="*" element={<StationRouteNotFound />} />
      </Routes>
    </div>
  )
}
