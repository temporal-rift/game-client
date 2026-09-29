import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, matchPath, useLocation, useNavigate } from 'react-router'
import { checkApiConnectivity } from './api/connectivity'
import { queryClient } from './api/queryClient'
import { createAuthenticatedFetch } from './auth/authenticatedFetch'
import { parseLegacyLobbyInvitation } from './auth/invitation'
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
import { GameRoute } from './pages/GamePage'
import { HomeRedirect } from './pages/HomeRedirect'
import { LobbyPage } from './pages/LobbyPage'
import { GAME_ROUTE, HOME_PATH, LOBBY_PATH, LOBBY_ROUTE, isResourceReference } from './routing/paths'

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
      <BrowserRouter>
        <SignedInRoutes {...props} />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

function SignedInRoutes({ config, playerSession, authSession }: SignedInViewProps) {
  const authenticatedFetch = useMemo(
    () => createAuthenticatedFetch(playerSession.getAccessToken),
    [playerSession],
  )
  const fetchWithUnauthorized = useMemo(
    () =>
      ((input: RequestInfo | URL, init: RequestInit = {}) =>
        authenticatedFetch(input, { ...init, onUnauthorized: playerSession.handleUnauthorized })) as (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => Promise<Response>,
    [authenticatedFetch, playerSession],
  )
  const location = useLocation()
  const navigate = useNavigate()
  // The lobby named by the page the player opened (its own page or a legacy
  // invitation) wins over a lobby remembered from an earlier visit.
  const [initialLobbyId] = useState(() => {
    const routeLobbyId = matchPath(LOBBY_ROUTE, location.pathname)?.params.lobbyId
    if (isResourceReference(routeLobbyId)) {
      return routeLobbyId
    }
    return location.pathname === HOME_PATH ? (parseLegacyLobbyInvitation(location.search)?.lobbyId ?? null) : null
  })
  const pathnameRef = useRef(location.pathname)
  useEffect(() => {
    pathnameRef.current = location.pathname
  }, [location.pathname])
  const handleLobbyIdChange = useCallback(
    (lobbyId: string | null) => {
      // Leaving (or losing) the lobby this page shows returns to create/join.
      if (lobbyId === null && matchPath(LOBBY_ROUTE, pathnameRef.current)) {
        navigate(LOBBY_PATH, { replace: true })
      }
    },
    [navigate],
  )
  const lobby = useLobby({
    apiBaseUrl: config.apiBaseUrl,
    perspectiveKey: authSession.identity.subject,
    fetchFn: fetchWithUnauthorized,
    initialLobbyId,
    onLobbyIdChange: handleLobbyIdChange,
  })
  const renderSessionBar = (faction: string | null) => (
    <SessionBar identity={authSession.identity} faction={faction} onSignOut={() => void playerSession.signOut()} />
  )
  const lobbyPage = (
    <LobbyPage
      lobby={lobby}
      defaultPlayerName={authSession.identity.displayName ?? ''}
      sessionBar={renderSessionBar(null)}
    />
  )

  return (
    <Routes>
      <Route path={HOME_PATH} element={<HomeRedirect lobby={lobby} />} />
      <Route path={LOBBY_PATH} element={lobbyPage} />
      <Route path={LOBBY_ROUTE} element={lobbyPage} />
      <Route
        path={GAME_ROUTE}
        element={
          <GameRoute
            apiBaseUrl={config.apiBaseUrl}
            fetchFn={fetchWithUnauthorized}
            authSession={authSession}
            lobby={lobby}
            renderSessionBar={renderSessionBar}
          />
        }
      />
      <Route path="*" element={<Navigate to={HOME_PATH} replace />} />
    </Routes>
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
