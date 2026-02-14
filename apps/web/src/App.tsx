import { useMemo, useState } from 'react'

function App() {
  const [isInfinite, setIsInfinite] = useState(true)
  const [targetCycles, setTargetCycles] = useState('10')
  const [status, setStatus] = useState<'running' | 'paused' | 'completed'>('running')
  const [pausedReason, setPausedReason] = useState<string | null>(null)
  const [cyclesCompleted, setCyclesCompleted] = useState(3)

  const finiteTarget = Number.parseInt(targetCycles, 10)
  const normalizedTarget = Number.isNaN(finiteTarget) ? 0 : finiteTarget
  const progressLabel = useMemo(() => {
    if (isInfinite) {
      return `${cyclesCompleted} / ∞`
    }

    return `${cyclesCompleted} / ${Math.max(normalizedTarget, 0)}`
  }, [cyclesCompleted, isInfinite, normalizedTarget])

  function simulateBlocked() {
    setStatus('paused')
    setPausedReason('insufficient_inputs')
  }

  function resume() {
    setStatus('running')
    setPausedReason(null)
  }

  function completeFinite() {
    if (!isInfinite) {
      setCyclesCompleted(Math.max(normalizedTarget, 0))
      setStatus('completed')
      setPausedReason(null)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-sky-900 to-cyan-800 px-4 py-8 text-slate-100">
      <div className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-cyan-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-14 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />
      <section className="w-full max-w-2xl rounded-2xl border border-white/20 bg-white/10 p-7 shadow-2xl backdrop-blur-md">
        <p className="mb-2 text-xs uppercase tracking-[0.25em] text-cyan-200">Beltwork</p>
        <h1 className="mb-2 text-3xl font-semibold text-white">Log in</h1>
        <p className="mb-6 text-sm text-slate-200">
          Access your game dashboard and manage your settlements.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <form className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-100">Email</span>
              <input
                type="email"
                required
                placeholder="pilot@beltwork.space"
                className="w-full rounded-lg border border-white/30 bg-white/85 px-3 py-2 text-slate-900 outline-none ring-cyan-400 transition focus:ring-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-100">Password</span>
              <input
                type="password"
                required
                placeholder="Your password"
                className="w-full rounded-lg border border-white/30 bg-white/85 px-3 py-2 text-slate-900 outline-none ring-cyan-400 transition focus:ring-2"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 font-medium text-slate-900 transition hover:bg-cyan-300"
            >
              Sign in
            </button>
            <p className="mt-4 text-center text-xs text-slate-200">
              New commander? Create your account in the onboarding flow.
            </p>
          </form>
          <section
            aria-label="Factory queue configuration"
            className="rounded-xl border border-white/20 p-4"
          >
            <h2 className="mb-3 text-lg font-semibold">Factory Queue</h2>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isInfinite}
                onChange={(event) => {
                  setIsInfinite(event.target.checked)
                  setStatus('running')
                  setPausedReason(null)
                }}
              />
              Infinite production
            </label>
            {!isInfinite && (
              <label className="mb-3 block text-sm">
                <span className="mb-1 block">Target cycles</span>
                <input
                  type="number"
                  min={1}
                  value={targetCycles}
                  onChange={(event) => setTargetCycles(event.target.value)}
                  className="w-full rounded-lg border border-white/30 bg-white/85 px-3 py-2 text-slate-900 outline-none ring-cyan-400 transition focus:ring-2"
                />
              </label>
            )}
            <dl className="mb-3 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt>Status</dt>
                <dd>{status}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Progress</dt>
                <dd>{progressLabel}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Paused reason</dt>
                <dd>{pausedReason ?? 'none'}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={simulateBlocked}
                className="rounded-lg border border-white/40 px-3 py-1.5 text-sm"
              >
                Simulate blocked
              </button>
              <button
                type="button"
                onClick={resume}
                className="rounded-lg border border-white/40 px-3 py-1.5 text-sm"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={completeFinite}
                className="rounded-lg border border-white/40 px-3 py-1.5 text-sm"
              >
                Complete finite
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default App
