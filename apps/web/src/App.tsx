function App() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-sky-900 to-cyan-800 px-4 py-8 text-slate-100">
      <div className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-cyan-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-14 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />
      <section className="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-7 shadow-2xl backdrop-blur-md">
        <p className="mb-2 text-xs uppercase tracking-[0.25em] text-cyan-200">Beltwork</p>
        <h1 className="mb-2 text-3xl font-semibold text-white">Log in</h1>
        <p className="mb-6 text-sm text-slate-200">
          Access your game dashboard and manage your settlements.
        </p>
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
        </form>
        <p className="mt-4 text-center text-xs text-slate-200">
          New commander? Create your account in the onboarding flow.
        </p>
      </section>
    </main>
  )
}

export default App
