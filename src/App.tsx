import { useCallback, useEffect, useMemo, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import type { AuthenticatedFetchFn } from './api/client'
import { checkApiConnectivity } from './api/connectivity'
import { queryClient } from './api/queryClient'
import { createAuthenticatedFetch } from './auth/authenticatedFetch'
import { lobbyIdFromLocation } from './auth/invitation'
import type { PlayerSession } from './auth/usePlayerSession'
import { usePlayerSession } from './auth/usePlayerSession'
import type { AuthSession } from './auth/session'
import { resolveAppConfig } from './config/appConfig'
import type { AppConfig } from './config/appConfig'
import { useLobby } from './lobby/useLobby'
import { AuthErrorNotice } from './components/AuthErrorNotice'
import { ConfigurationErrorNotice } from './components/ConfigurationErrorNotice'
import { ConnectivityErrorNotice } from './components/ConnectivityErrorNotice'
import { SessionBar } from './components/SessionBar'
import { SignInPanel } from './components/SignInPanel'
import { createAppRouter } from './routing/router'
import { SignedInContext } from './routing/signedInContext'

type ConnectivityState =
  | { readonly status: 'checking' }
  | { readonly status: 'connected' }
  | { readonly status: 'failed'; readonly reason: string }

interface SignedInViewProps {
  readonly config: AppConfig
  readonly playerSession: PlayerSession
  readonly authSession: AuthSession
}

/**
 * The router mounts only under a signed-in session. Sign-in completes on
 * `/auth/callback` and leaves it (history.replaceState) for the page the
 * player started from before any route renders, so the router always starts
 * on an app page.
 */
function SignedInView(props: SignedInViewProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SignedInSessionView {...props} />
    </QueryClientProvider>
  )
}

function SignedInSessionView({ config, playerSession, authSession }: SignedInViewProps) {
  const authenticatedFetch = useMemo(
    () => createAuthenticatedFetch(playerSession.getAccessToken),
    [playerSession],
  )
  const fetchFn = useMemo(
    () =>
      ((input: RequestInfo | URL, init: RequestInit = {}) =>
        authenticatedFetch(input, { ...init, onUnauthorized: playerSession.handleUnauthorized })) as AuthenticatedFetchFn,
    [authenticatedFetch, playerSession],
  )
  const perspective = authSession.identity.subject
  const scope = useMemo(() => ({ perspective, apiBaseUrl: config.apiBaseUrl, fetchFn }), [perspective, config.apiBaseUrl, fetchFn])
  const [router] = useState(() => createAppRouter({ queryClient, scope }))
  // The lobby named by the page the player opened (its own page or a legacy
  // invitation) wins over a lobby remembered from an earlier visit.
  const [initialLobbyId] = useState(() => lobbyIdFromLocation(window.location.pathname, window.location.search))

  const handleLobbyIdChange = useCallback(
    (lobbyId: string | null) => {
      // Leaving (or losing) the lobby this page shows returns to create/join.
      if (lobbyId === null && router.state.matches.some((match) => match.routeId === '/lobbies/$lobbyId')) {
        void router.navigate({ to: '/lobby', replace: true })
      }
    },
    [router],
  )
  const lobby = useLobby({
    apiBaseUrl: config.apiBaseUrl,
    perspectiveKey: perspective,
    fetchFn,
    initialLobbyId,
    onLobbyIdChange: handleLobbyIdChange,
  })
  const renderSessionBar = useCallback(
    (faction: string | null) => (
      <SessionBar identity={authSession.identity} faction={faction} onSignOut={() => void playerSession.signOut()} />
    ),
    [authSession.identity, playerSession],
  )
  const session = useMemo(
    () => ({ config, fetchFn, authSession, lobby, renderSessionBar }),
    [config, fetchFn, authSession, lobby, renderSessionBar],
  )

  return (
    <SignedInContext.Provider value={session}>
      <RouterProvider router={router} context={{ queryClient, scope }} />
    </SignedInContext.Provider>
  )
}

function App() {
  const configResult = useMemo(() => resolveAppConfig(window.__APP_CONFIG__ ?? {}), [])
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
    return <output className="connection-status">Checking connection…</output>
  }

  if (connectivity.status === 'failed') {
    return <ConnectivityErrorNotice reason={connectivity.reason} onRetry={retry} />
  }

  const sessionStatus = session.status
  switch (sessionStatus.state) {
    case 'restoring':
      return <output>Restoring session…</output>
    case 'signing-in':
      return <output>Redirecting to sign-in…</output>
    case 'handling-callback':
      return <output>Completing sign-in…</output>
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
        <SignedInView
          config={configResult.config}
          playerSession={session}
          authSession={sessionStatus.session}
        />
      )
  }
}

export default App
