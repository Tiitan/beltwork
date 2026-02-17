import type { SubmitEvent } from 'react'

/**
 * Input contract for the login page actions.
 */
type LoginPageProps = {
  onSignIn: (event: SubmitEvent<HTMLFormElement>) => void
  onStartNow: () => void
}

/**
 * Renders the authentication entry screen.
 *
 * @param props Login event handlers for sign-in and guest start.
 * @returns Login page UI.
 */
export function LoginPage({ onSignIn, onStartNow }: LoginPageProps) {
  const cardClassName =
    'overflow-hidden rounded-2xl border border-slate-300/30 bg-slate-900/45 shadow-xl backdrop-blur-md'
  const labelClassName = 'text-sm text-slate-300'
  const fieldClassName =
    'mb-1 rounded-md border border-slate-400/45 bg-slate-950/60 px-3 py-2 text-slate-100'
  const buttonClassName =
    'cursor-pointer rounded-md border border-teal-300/70 bg-gradient-to-br from-teal-500 to-cyan-700 px-3 py-2 text-teal-50 transition hover:brightness-110'

  return (
    <section aria-label="Login page" className="mx-auto w-full max-w-3xl pt-8 md:pt-16">
      <p className="mb-1 text-xs uppercase tracking-widest text-sky-200">Beltwork Relay</p>
      <h1 className="text-3xl tracking-tight md:text-4xl">Log in</h1>
      <p className="mt-2 text-slate-300">Start as a guest or sign in with your account.</p>

      <div className={`${cardClassName} mt-5 flex justify-center p-4`}>
        <form onSubmit={onSignIn} className="grid w-full max-w-xl gap-2">
          <label htmlFor="email" className={labelClassName}>
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            className={fieldClassName}
          />

          <label htmlFor="password" className={labelClassName}>
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            className={fieldClassName}
          />

          <button type="submit" className={buttonClassName}>
            Sign in
          </button>
        </form>
      </div>

      <button type="button" onClick={onStartNow} className={`${buttonClassName} mt-5 w-full`}>
        Start now
      </button>
    </section>
  )
}
