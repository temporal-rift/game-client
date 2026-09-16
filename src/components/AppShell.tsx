import { useState } from 'react'
import type { PlayerView } from '../types/playerView'
import { ActionConfirmationPanel, type SelectedTarget } from './ActionConfirmationPanel'
import { EventBoard } from './EventBoard'
import { FactionIntelPanel } from './FactionIntelPanel'
import { PrivateHand } from './PrivateHand'
import { RiftMark } from './icons'

interface AppShellProps {
  readonly playerView: PlayerView
  readonly isSampleData: boolean
}

interface SelectionState {
  readonly gameId: string
  readonly cardId: string | null
  readonly targetId: string | null
}

function selectionFrom(playerView: PlayerView): SelectionState {
  return {
    gameId: playerView.gameId,
    cardId: playerView.pendingAction?.cardId ?? null,
    targetId: playerView.pendingAction?.targetId ?? null,
  }
}

function findSelectedTarget(playerView: PlayerView, targetId: string | null): SelectedTarget | null {
  if (!targetId) {
    return null
  }
  for (const event of playerView.events) {
    const outcome = event.outcomes.find((candidate) => candidate.id === targetId)
    if (outcome?.isValidTarget) {
      return { event, outcome }
    }
  }
  return null
}

export function AppShell({ playerView, isSampleData }: AppShellProps) {
  const [selection, setSelection] = useState<SelectionState>(() => selectionFrom(playerView))

  const selectionForCurrentGame = selection.gameId === playerView.gameId ? selection : selectionFrom(playerView)
  const selectedCard =
    playerView.hand.find((card) => card.id === selectionForCurrentGame.cardId && card.isAvailable) ?? null
  const selectedTarget = findSelectedTarget(playerView, selectionForCurrentGame.targetId)
  const effectiveCardId = selectedCard?.id ?? null
  const effectiveTargetId = selectedTarget?.outcome.id ?? null

  const toggleCard = (cardId: string) => {
    setSelection((current) => ({
      gameId: playerView.gameId,
      cardId: effectiveCardId === cardId ? null : cardId,
      targetId: current.gameId === playerView.gameId ? current.targetId : playerView.pendingAction?.targetId ?? null,
    }))
  }

  const toggleTarget = (targetId: string) => {
    setSelection((current) => ({
      gameId: playerView.gameId,
      cardId: current.gameId === playerView.gameId ? current.cardId : playerView.pendingAction?.cardId ?? null,
      targetId: effectiveTargetId === targetId ? null : targetId,
    }))
  }

  return (
    <div className="app-shell">
      <header className="game-header">
        <div className="brand-lockup">
          <RiftMark />
          <div>
            <h1>Temporal Rift</h1>
            <p>Multiplayer strategy / {playerView.gameLabel}</p>
          </div>
        </div>
        <div className="phase-pills" aria-label="Current game phase">
          <span>Era {playerView.currentEra}</span>
          <span>
            Round {playerView.currentRound} of {playerView.roundsPerEra}
          </span>
        </div>
        <div className="deadline-block">
          <span>{playerView.phaseLabel}</span>
          {playerView.phaseDeadlineLabel && <strong>{playerView.phaseDeadlineLabel}</strong>}
          <i aria-hidden="true" />
        </div>
        {isSampleData && <p className="sample-state" role="status">Sample board · actions are disabled</p>}
      </header>

      <section className="player-strip" aria-label="Player scores">
        <ul>
          {playerView.players.map((player) => (
            <li key={player.id} className={player.isCurrentPlayer ? 'is-current-player' : undefined}>
              <span className="player-avatar" aria-hidden="true">{player.displayName.slice(0, 1)}</span>
              <span className="player-identity">
                <strong>{player.displayName}</strong>
                <small>{player.isCurrentPlayer ? 'Your private seat' : 'Faction hidden'}</small>
              </span>
              <span className="player-score">
                <strong>{player.score}</strong>
                <small>Points</small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <main className="game-board-layout">
        <FactionIntelPanel faction={playerView.faction} />
        <EventBoard
          events={playerView.events}
          publicBandAgeLabel={playerView.publicBandAgeLabel}
          selectedTargetId={effectiveTargetId}
          onSelectTarget={toggleTarget}
        />
        <PrivateHand hand={playerView.hand} selectedCardId={effectiveCardId} onSelectCard={toggleCard} />
        <ActionConfirmationPanel
          selectedCard={selectedCard}
          selectedTarget={selectedTarget}
          confirmLabel={playerView.pendingAction?.confirmLabel ?? 'Confirm action'}
          roundStatus={playerView.roundStatus}
          isSampleData={isSampleData}
        />
      </main>
      <footer className="game-footer">
        <span>Player-safe fixture preview</span>
        <span>DOM controls · SVG artwork · no canvas renderer</span>
      </footer>
    </div>
  )
}
