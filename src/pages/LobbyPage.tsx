import { useEffect, useRef, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { LobbyPanel } from '../components/LobbyPanel'
import { RiftMark } from '../components/icons'
import type { LobbySession } from '../lobby/useLobby'
import { LOBBY_PATH, gamePath, isResourceReference, lobbyPath } from '../routing/paths'

interface LobbyPageProps {
  readonly lobby: LobbySession
  readonly defaultPlayerName: string
  readonly sessionBar: ReactNode
}

/**
 * Serves both `/lobby` (create or join) and `/lobbies/{lobbyId}` (one lobby,
 * also the invitation target). The page always shows the lobby the player
 * actually belongs to, and follows a start into the game as it happens.
 */
export function LobbyPage({ lobby, defaultPlayerName, sessionBar }: LobbyPageProps) {
  const { lobbyId: routeLobbyId } = useParams()
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
      navigate(gamePath(startedGameId))
    }
  }, [status, startedGameId, navigate])

  if (routeLobbyId !== undefined && !isResourceReference(routeLobbyId)) {
    return <Navigate to={LOBBY_PATH} replace />
  }
  if (view && view.lobbyId !== routeLobbyId) {
    return <Navigate to={lobbyPath(view.lobbyId)} replace />
  }

  return (
    <div className="lobby-page">
      <header className="page-bar">
        <div className="brand-lockup">
          <RiftMark />
          <h1>Temporal Rift</h1>
        </div>
        <div className="page-bar-actions">{sessionBar}</div>
      </header>
      <main className="lobby-card">
        <LobbyPanel lobby={lobby} defaultPlayerName={defaultPlayerName} invitedLobbyId={routeLobbyId ?? null} />
      </main>
    </div>
  )
}
