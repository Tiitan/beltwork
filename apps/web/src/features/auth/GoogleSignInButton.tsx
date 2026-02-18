import { useEffect, useRef } from 'react'

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleSignInButtonProps = {
  mode: 'login' | 'link'
  onSuccess: (idToken: string) => void
  onError: (message: string) => void
}

type GoogleWindow = Window & {
  google?: {
    accounts?: {
      id?: {
        initialize: (config: Record<string, unknown>) => void
        renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
      }
    }
  }
}

let googleIdentityReadyPromise: Promise<void> | null = null

function hasGoogleIdentityApi(): boolean {
  return Boolean((window as GoogleWindow).google?.accounts?.id)
}

function getGoogleIdentityScript(): HTMLScriptElement | null {
  return document.querySelector('script[data-google-identity="true"]') as HTMLScriptElement | null
}

function ensureGoogleIdentityReady(): Promise<void> {
  if (hasGoogleIdentityApi()) {
    return Promise.resolve()
  }

  if (googleIdentityReadyPromise) {
    return googleIdentityReadyPromise
  }

  const promise = new Promise<void>((resolve, reject) => {
    const resolveIfReady = () => {
      if (hasGoogleIdentityApi()) {
        resolve()
        return true
      }

      return false
    }

    const onLoad = () => {
      // Google initializes `window.google` asynchronously right after script load.
      window.setTimeout(() => {
        if (!resolveIfReady()) {
          reject(new Error('google_identity_not_available'))
        }
      }, 0)
    }

    const onError = () => {
      reject(new Error('failed_to_load_google_identity_script'))
    }

    const existingScript = getGoogleIdentityScript()
    if (existingScript) {
      if (existingScript.dataset.googleIdentityLoaded === 'true') {
        onLoad()
        return
      }

      existingScript.addEventListener('load', onLoad, { once: true })
      existingScript.addEventListener('error', onError, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.addEventListener(
      'load',
      () => {
        script.dataset.googleIdentityLoaded = 'true'
        onLoad()
      },
      { once: true },
    )
    script.addEventListener('error', onError, { once: true })
    document.head.appendChild(script)
  })

  googleIdentityReadyPromise = promise.catch((error) => {
    googleIdentityReadyPromise = null
    throw error
  })

  return googleIdentityReadyPromise
}

export function GoogleSignInButton({ mode, onSuccess, onError }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    if (!clientId) {
      onError('missing_google_client_id')
      return
    }

    let cancelled = false

    async function setupGoogleButton() {
      try {
        await ensureGoogleIdentityReady()
        if (cancelled) {
          return
        }

        const googleWindow = window as GoogleWindow
        const accountsId = googleWindow.google?.accounts?.id
        if (!accountsId || !containerRef.current) {
          onError('google_identity_not_available')
          return
        }

        containerRef.current.innerHTML = ''
        accountsId.initialize({
          client_id: clientId,
          callback: (response: GoogleCredentialResponse) => {
            if (typeof response.credential !== 'string' || response.credential.length === 0) {
              onError('google_credential_missing')
              return
            }

            onSuccess(response.credential)
          },
        })
        accountsId.renderButton(containerRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: mode === 'login' ? 'signin_with' : 'continue_with',
          width: 280,
        })
      } catch {
        onError('failed_to_load_google_identity_script')
      }
    }

    void setupGoogleButton()

    return () => {
      cancelled = true
    }
  }, [clientId, mode, onError, onSuccess])

  return <div ref={containerRef} aria-label={mode === 'login' ? 'Google sign in' : 'Google link'} />
}
