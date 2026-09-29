import { Navigate } from '@tanstack/react-router'
import { useSignedIn } from '../routing/signedInContext'

/**
 * `/` has no page of its own: it sends the player to their started game, their
 * lobby, or create/join, once lobby recovery has settled. (Legacy
 * `/?game=<lobbyId>` invitations are redirected by the route before this renders.)
 */
export function HomeRedirect() {
  const { phase, lastGameId, lobby: view } = useSignedIn().lobby.state
  if (phase.kind === 'working' && phase.action === 'loading') {
    return <output className="connection-status">Loading your lobby…</output>
  }
  if (lastGameId) {
    return <Navigate to="/games/$gameId" params={{ gameId: lastGameId }} replace />
  }
  return view ? <Navigate to="/lobbies/$lobbyId" params={{ lobbyId: view.lobbyId }} replace /> : <Navigate to="/lobby" replace />
}
