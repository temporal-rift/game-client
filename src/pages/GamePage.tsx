import { useMemo } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useActionSubmission } from '../action/useActionSubmission'
import { toBoardView } from '../board/boardView'
import { FactionIllustration } from '../illustrations/catalog'
import { AppShell } from '../components/AppShell'
import { useDeclaration } from '../declaration/useDeclaration'
import { useGameState } from '../game/useGameState'
import { useHandSelection } from '../hand/useHandSelection'
import { useKnowledge } from '../knowledge/useKnowledge'
import { useParadoxResolution } from '../paradox/useParadoxResolution'
import { useResults } from '../results/useResults'
import { useRoundSummary } from '../round-summary/useRoundSummary'
import { useSignedIn } from '../routing/signedInContext'

/** `/games/{gameId}`: the game named in the URL, so reloads and bookmarks land on it. */
export function GameRoute() {
  const { gameId } = useParams({ from: '/games/$gameId' })
  // Keyed so every per-game hook starts clean when the route switches games.
  return <GamePage key={gameId} gameId={gameId} />
}

function GamePage({ gameId }: { readonly gameId: string }) {
  const { config, fetchFn, authSession, lobby, renderSessionBar } = useSignedIn()
  const apiBaseUrl = config.apiBaseUrl
  const lobbyView = lobby.state.lobby
  // Seat-bound controls need the player's own lobby membership for this game;
  // any other game (e.g. a finished one opened from a link) shows results only.
  const isLobbyGame = (lobby.state.lastGameId ?? lobbyView?.gameId ?? null) === gameId
  const ownPlayerId = isLobbyGame ? lobby.state.ownPlayerId : null
  const perspectiveKey = authSession.identity.subject

  const gameState = useGameState({ apiBaseUrl, fetchFn, gameId, perspectiveKey })
  const results = useResults({ apiBaseUrl, fetchFn, gameState, ownPlayerId, perspectiveKey })
  const action = useActionSubmission({ apiBaseUrl, fetchFn, gameState, ownPlayerId })
  const handSelection = useHandSelection({ apiBaseUrl, fetchFn, gameState })
  const declaration = useDeclaration({ apiBaseUrl, fetchFn, gameState })
  const paradox = useParadoxResolution({ apiBaseUrl, fetchFn, gameState })
  const knowledge = useKnowledge({ gameState })
  const roundSummary = useRoundSummary({ gameState })
  const board = useMemo(() => (gameState.state ? toBoardView(gameState.state, ownPlayerId) : null), [gameState.state, ownPlayerId])

  return (
    <div className="game-page">
      <nav className="page-bar game-page-bar" aria-label="Game navigation">
        {isLobbyGame && lobbyView ? (
          <Link className="page-link" to="/lobbies/$lobbyId" params={{ lobbyId: lobbyView.lobbyId }}>
            Back to lobby
          </Link>
        ) : (
          <Link className="page-link" to="/lobby">
            Back to lobby
          </Link>
        )}
        <span className="current-player-session">
          {renderSessionBar(gameState.state?.myFaction ?? null)}
          {gameState.state?.myFaction && <FactionIllustration faction={gameState.state.myFaction} skin={config.illustrationSkin} />}
        </span>
      </nav>
      <AppShell
        view={board}
        status={gameState.status}
        onRetry={() => void gameState.refresh()}
        handSelection={handSelection}
        illustrationSkin={config.illustrationSkin}
        action={isLobbyGame ? action : null}
        paradox={isLobbyGame ? paradox : null}
        declaration={isLobbyGame ? declaration : null}
        knowledge={isLobbyGame ? knowledge : null}
        roundSummary={roundSummary}
        results={results}
        ownPlayerId={ownPlayerId}
      />
    </div>
  )
}
