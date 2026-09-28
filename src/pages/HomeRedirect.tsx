import { Navigate, useLocation } from 'react-router'
import { parseLegacyLobbyInvitation } from '../auth/invitation'
import type { LobbySession } from '../lobby/useLobby'
import { LOBBY_PATH, gamePath, lobbyPath } from '../routing/paths'

/**
 * `/` has no page of its own: it sends the player to their started game, their
 * lobby, or create/join, once lobby recovery has settled. Legacy
 * `/?game=<lobbyId>` invitations land on that lobby's page.
 */
export function HomeRedirect({ lobby }: { readonly lobby: LobbySession }) {
  const { search } = useLocation()
  const legacyInvitation = parseLegacyLobbyInvitation(search)
  if (legacyInvitation) {
    return <Navigate to={lobbyPath(legacyInvitation.lobbyId)} replace />
  }

  const { phase, lastGameId, lobby: view } = lobby.state
  if (phase.kind === 'working' && phase.action === 'loading') {
    return <output className="connection-status">Loading your lobby…</output>
  }
  if (lastGameId) {
    return <Navigate to={gamePath(lastGameId)} replace />
  }
  return <Navigate to={view ? lobbyPath(view.lobbyId) : LOBBY_PATH} replace />
}
