import type { FormEvent } from 'react'

type PlaceholderAssets = {
  loginBackground: string
  stationBackground: string
  loginIllustration: string
  stationBackdrop: string
  panelTexture: string
}

type LoginPageProps = {
  placeholderAssets: PlaceholderAssets
  onSignIn: (event: FormEvent<HTMLFormElement>) => void
  onStartNow: () => void
}

export function LoginPage({ placeholderAssets, onSignIn, onStartNow }: LoginPageProps) {
  return (
    <section aria-label="Login page" className="screen login-screen">
      <p className="eyebrow">Beltwork Relay</p>
      <h1>Log in</h1>
      <p className="screen-intro">Start as a guest or sign in with your account.</p>

      <div className="card login-layout">
        <form onSubmit={onSignIn} className="stack-form">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" name="email" autoComplete="email" />

          <label htmlFor="password">Password</label>
          <input id="password" type="password" name="password" autoComplete="current-password" />

          <button type="submit">Sign in</button>
        </form>

        <div className="panel placeholder-panel">
          <p className="panel-title">Placeholder assets</p>
          <p>Background: {placeholderAssets.loginBackground}</p>
          <p>Character: {placeholderAssets.loginIllustration}</p>
          <p>Panel texture: {placeholderAssets.panelTexture}</p>
        </div>
      </div>

      <div className="login-actions">
        <p>or</p>
        <button type="button" onClick={onStartNow}>
          Start now
        </button>
      </div>
    </section>
  )
}
