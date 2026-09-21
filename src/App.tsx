import { useCallback, useEffect, useMemo, useState } from 'react'
import { checkApiConnectivity } from './api/connectivity'
import { createAuthenticatedFetch } from './auth/authenticatedFetch'
import { parseLobbyInvitation, writeLobbyInvitationToUrl } from './auth/invitation'
import type { PlayerSession } from './auth/usePlayerSession'
import { usePlayerSession } from './auth/usePlayerSession'
import type { AuthSession } from './auth/session'
import { resolveAppConfig } from './config/appConfig'
import type { AppConfig } from './config/appConfig'
import { useActionSubmission } from './action/useActionSubmission'
import { useKnowledge } from './knowledge/useKnowledge'
import { useLobby } from './lobby/useLobby'
import { useParadoxResolution } from './paradox/useParadoxResolution'
import { useResults } from './results/useResults'
import { ActionPanel } from './components/ActionPanel'
import { AppShell } from './components/AppShell'
import { AuthErrorNotice } from './components/AuthErrorNotice'
import { ConfigurationErrorNotice } from './components/ConfigurationErrorNotice'
import { ConnectivityErrorNotice } from './components/ConnectivityErrorNotice'
import { KnowledgePanel } from './components/KnowledgePanel'
import { LobbyPanel } from './components/LobbyPanel'
import { ParadoxResolutionPanel } from './components/ParadoxResolutionPanel'
import { ResultsPanel } from './components/ResultsPanel'
import { SessionBar } from './components/SessionBar'
import { SignInPanel } from './components/SignInPanel'
import { sampleFixturePlayerView } from './fixtures/playerView'

type ConnectivityState =
  | { readonly status: 'checking' }
  | { readonly status: 'connected' }
  | { readonly status: 'failed'; readonly reason: string }

function defaultPlayerNameFor(identity: AuthSession['identity']): string {
  if (identity.displayName && identity.displayName.trim().length > 0) {
    return identity.displayName.trim()
  }
  return identity.subject.length > 12 ? `player-${identity.subject.slice(-4)}` : 'player'
}

function SignedInView({
  config,
  playerSession,
  authSession,
}: {
  readonly config: AppConfig
  readonly playerSession: PlayerSession
  readonly authSession: AuthSession
}) {
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
  const initialLobbyId = useMemo(() => parseLobbyInvitation(window.location.search)?.lobbyId ?? null, [])
  const lobby = useLobby({
    apiBaseUrl: config.apiBaseUrl,
    fetchFn: fetchWithUnauthorized,
    initialLobbyId,
    onLobbyIdChange: writeLobbyInvitationToUrl,
  })
  const activeGameId = lobby.state.lastGameId ?? lobby.state.lobby?.gameId ?? null
  const results = useResults({
    apiBaseUrl: config.apiBaseUrl,
    fetchFn: fetchWithUnauthorized,
    gameId: activeGameId,
    ownPlayerId: lobby.state.ownPlayerId,
    perspectiveKey: authSession.identity.subject,
  })
  const action = useActionSubmission({
    apiBaseUrl: config.apiBaseUrl,
    fetchFn: fetchWithUnauthorized,
    gameId: activeGameId,
    ownPlayerId: lobby.state.ownPlayerId,
    perspectiveKey: authSession.identity.subject,
  })
  const paradox = useParadoxResolution({
    apiBaseUrl: config.apiBaseUrl,
    fetchFn: fetchWithUnauthorized,
    gameId: activeGameId,
    perspectiveKey: authSession.identity.subject,
  })
  const knowledge = useKnowledge({
    apiBaseUrl: config.apiBaseUrl,
    fetchFn: fetchWithUnauthorized,
    gameId: activeGameId,
    perspectiveKey: authSession.identity.subject,
  })

  return (
    <div>
      <SessionBar identity={authSession.identity} onSignOut={() => void playerSession.signOut()} />
      <LobbyPanel lobby={lobby} defaultPlayerName={defaultPlayerNameFor(authSession.identity)} />
      {activeGameId && (
        <ActionPanel
          view={action.view}
          draft={action.draft}
          submitPhase={action.submitPhase}
          onSelectCard={action.selectCard}
          onSelectSpecial={action.selectSpecial}
          onClearDraft={action.clearDraft}
          onConfirm={() => void action.confirm()}
          onDismissRejection={action.dismissRejection}
        />
      )}
      {activeGameId && (
        <ParadoxResolutionPanel
          view={paradox.view}
          draft={paradox.draft}
          submitPhase={paradox.submitPhase}
          onSelectCard={paradox.selectCard}
          onSelectTarget={paradox.selectTarget}
          onClearDraft={paradox.clearDraft}
          onConfirm={() => void paradox.confirm()}
          onDismissRejection={paradox.dismissRejection}
        />
      )}
      {activeGameId && <KnowledgePanel view={knowledge.view} />}
      {(activeGameId || results.view.kind !== 'active') && (
        <ResultsPanel
          view={results.view}
          ownPlayerId={lobby.state.ownPlayerId}
          error={results.message}
          isRefreshing={results.isRefreshing}
          onRefresh={() => void results.refresh()}
        />
      )}
      <AppShell key={authSession.identity.subject} playerView={sampleFixturePlayerView} isSampleData />
    </div>
  )
}

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
