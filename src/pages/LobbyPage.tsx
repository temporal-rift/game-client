import { useEffect, useRef } from 'react'
import { Navigate, useNavigate, useParams } from '@tanstack/react-router'
import { LobbyPanel } from '../components/LobbyPanel'
import { RiftMark } from '../components/icons'
import { PlayerReference } from '../components/PlayerReference'
import { useSignedIn } from '../routing/signedInContext'

/**
 * Serves both `/lobby` (create or join) and `/lobbies/{lobbyId}` (one lobby,
 * also the invitation target). The page always shows the lobby the player
 * actually belongs to, and follows a start into the game as it happens.
 */
export function LobbyPage() {
  const { lobby, authSession, renderSessionBar } = useSignedIn()
  const defaultPlayerName = authSession.identity.displayName ?? ''
  // Serves both routes: only `/lobbies/$lobbyId` names a lobby.
  const { lobbyId: routeLobbyId } = useParams({ strict: false })
  const navigate = useNavigate()
  const view = lobby.state.lobby
  const status = view?.status
  const startedGameId = lobby.state.lastGameId

  // Only a start observed on this page moves the player into the game: a lobby
  // that had already started when opened stays viewable from "Back to lobby".
  const previousStatusRef = useRef(status)
  useEffect(() => {
    const previousStatus = previousStatusRef.current
    previousStatusRef.current = status
    if (previousStatus === 'WAITING' && status === 'STARTED' && startedGameId) {
      void navigate({ to: '/games/$gameId', params: { gameId: startedGameId } })
    }
  }, [status, startedGameId, navigate])

  if (view && view.lobbyId !== routeLobbyId) {
    return <Navigate to="/lobbies/$lobbyId" params={{ lobbyId: view.lobbyId }} replace />
  }

  return (
    <div className="lobby-page">
      <header className="page-bar">
        <div className="brand-lockup">
          <RiftMark />
          <h1>Temporal Rift</h1>
        </div>
        <div className="page-bar-actions">{renderSessionBar(null)}</div>
      </header>
      <main className="lobby-card">
        <PlayerReference />
        <LobbyPanel lobby={lobby} defaultPlayerName={defaultPlayerName} invitedLobbyId={routeLobbyId ?? null} />
      </main>
    </div>
  )
}
