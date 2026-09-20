import { useCallback, useEffect, useMemo, useState } from 'react'
import { checkApiConnectivity } from './api/connectivity'
import { identityKey } from './auth/session'
import { usePlayerSession } from './auth/usePlayerSession'
import { resolveAppConfig } from './config/appConfig'
import { AppShell } from './components/AppShell'
import { AuthErrorNotice } from './components/AuthErrorNotice'
import { ConfigurationErrorNotice } from './components/ConfigurationErrorNotice'
import { ConnectivityErrorNotice } from './components/ConnectivityErrorNotice'
import { SessionBar } from './components/SessionBar'
import { SignInPanel } from './components/SignInPanel'
import { sampleFixturePlayerView } from './fixtures/playerView'

type ConnectivityState =
  | { readonly status: 'checking' }
  | { readonly status: 'connected' }
  | { readonly status: 'failed'; readonly reason: string }

function App() {
  const configResult = useMemo(() => resolveAppConfig(import.meta.env), [])
  const config = configResult.ok ? configResult.config : null
  const session = usePlayerSession(config)
  const [connectivity, setConnectivity] = useState<ConnectivityState>({ status: 'checking' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!configResult.ok) {
      return
    }

    let cancelled = false
    void checkApiConnectivity(configResult.config.apiBaseUrl).then((result) => {
      if (cancelled) {
        return
      }
      setConnectivity(result.ok ? { status: 'connected' } : { status: 'failed', reason: result.reason })
    })

    return () => {
      cancelled = true
    }
  }, [configResult, attempt])

  const retry = useCallback(() => {
    setConnectivity({ status: 'checking' })
    setAttempt((previous) => previous + 1)
  }, [])

  if (!configResult.ok) {
    return <ConfigurationErrorNotice errors={configResult.errors} />
  }

  if (connectivity.status === 'checking') {
    return <p role="status">Checking connection…</p>
  }

  if (connectivity.status === 'failed') {
    return <ConnectivityErrorNotice reason={connectivity.reason} onRetry={retry} />
  }

  const sessionStatus = session.status
  switch (sessionStatus.state) {
    case 'restoring':
      return <p role="status">Restoring session…</p>
    case 'signing-in':
      return <p role="status">Redirecting to sign-in…</p>
    case 'handling-callback':
      return <p role="status">Completing sign-in…</p>
    case 'signed-out':
      return (
        <SignInPanel
          issuerUrl={configResult.config.oidcIssuerUrl}
          isSigningIn={false}
          notice={sessionStatus.reason}
          onSignIn={() => void session.signIn()}
        />
      )
    case 'error':
      return (
        <AuthErrorNotice
          message={sessionStatus.message}
          onRetry={() => void session.signIn()}
          onSignOut={session.signOut}
        />
      )
    case 'signed-in':
      return (
        <div>
          <SessionBar identity={sessionStatus.session.identity} onSignOut={session.signOut} />
          <AppShell
            key={identityKey(sessionStatus.session.identity)}
            playerView={sampleFixturePlayerView}
            isSampleData
          />
        </div>
      )
  }
}

export default App
