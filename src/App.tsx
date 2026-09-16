import { useCallback, useEffect, useMemo, useState } from 'react'
import { checkApiConnectivity } from './api/connectivity'
import { resolveAppConfig } from './config/appConfig'
import { AppShell } from './components/AppShell'
import { ConfigurationErrorNotice } from './components/ConfigurationErrorNotice'
import { ConnectivityErrorNotice } from './components/ConnectivityErrorNotice'
import { sampleFixturePlayerView } from './fixtures/playerView'

type ConnectivityState =
  | { readonly status: 'checking' }
  | { readonly status: 'connected' }
  | { readonly status: 'failed'; readonly reason: string }

function App() {
  const configResult = useMemo(() => resolveAppConfig(import.meta.env), [])
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

  return <AppShell playerView={sampleFixturePlayerView} isSampleData />
}

export default App
