import { Link, useParams } from '@tanstack/react-router'
import { useActionSubmission } from '../action/useActionSubmission'
import { ActionPanel } from '../components/ActionPanel'
import { FactionIllustration } from '../illustrations/catalog'
import { AppShell } from '../components/AppShell'
import { HandSelectionPanel } from '../components/HandSelectionPanel'
import { KnowledgePanel } from '../components/KnowledgePanel'
import { ParadoxResolutionPanel } from '../components/ParadoxResolutionPanel'
import { ResultsPanel } from '../components/ResultsPanel'
import { RoundSummaryPanel } from '../components/RoundSummaryPanel'
import { sampleFixturePlayerView } from '../fixtures/playerView'
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
  // Seat-bound panels need the player's own lobby membership for this game;
  // any other game (e.g. a finished one opened from a link) shows results only.
  const isLobbyGame = (lobby.state.lastGameId ?? lobbyView?.gameId ?? null) === gameId
  const ownPlayerId = isLobbyGame ? lobby.state.ownPlayerId : null
  const perspectiveKey = authSession.identity.subject

  const gameState = useGameState({ apiBaseUrl, fetchFn, gameId, perspectiveKey })
  const results = useResults({ apiBaseUrl, fetchFn, gameState, ownPlayerId, perspectiveKey })
  const action = useActionSubmission({ apiBaseUrl, fetchFn, gameState, ownPlayerId })
  const handSelection = useHandSelection({ apiBaseUrl, fetchFn, gameState })
  const paradox = useParadoxResolution({ apiBaseUrl, fetchFn, gameState, perspectiveKey })
  const knowledge = useKnowledge({ gameState })
  const roundSummary = useRoundSummary({ gameState })

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
      <HandSelectionPanel
        illustrationSkin={config.illustrationSkin}
        view={handSelection.view}
        selectedCardInstanceIds={handSelection.selectedCardInstanceIds}
        submitPhase={handSelection.submitPhase}
        onToggleCard={handSelection.toggleCard}
        onConfirm={() => void handSelection.confirm()}
        onDismissRejection={handSelection.dismissRejection}
      />
      {isLobbyGame && (
        <ActionPanel
          illustrationSkin={config.illustrationSkin}
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
      {isLobbyGame && (
        <ParadoxResolutionPanel
          illustrationSkin={config.illustrationSkin}
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
      {isLobbyGame && (
        <KnowledgePanel
          view={knowledge.view}
          error={knowledge.message}
          isRefreshing={knowledge.isRefreshing}
          onRefresh={() => void knowledge.refresh()}
        />
      )}
      {isLobbyGame && <RoundSummaryPanel view={roundSummary} />}
      <ResultsPanel
        view={results.view}
        ownPlayerId={ownPlayerId}
        error={results.message}
        isRefreshing={results.isRefreshing}
        onRefresh={() => void results.refresh()}
      />
      <AppShell key={perspectiveKey} playerView={sampleFixturePlayerView} isSampleData illustrationSkin={config.illustrationSkin} />
    </div>
  )
}
