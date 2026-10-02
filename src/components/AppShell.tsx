import type { ReactNode } from 'react'
import { actionSelectionFor, pickEvent, pickOutcome, pickPlayer, type ActionSelection, type OpenActionRoundView } from '../action/actionTargeting'
import type { ActionSubmissionSession } from '../action/useActionSubmission'
import type { BoardHeader, BoardView } from '../board/boardView'
import type { GameStateStatus } from '../game/useGameState'
import { formatCountdown, useDeadlineCountdown } from '../game/useDeadlineCountdown'
import type { HandSelectionSession } from '../hand/useHandSelection'
import type { IllustrationSkin } from '../illustrations/catalogData'
import { ActionRail } from './ActionRail'
import { EventBoard, type EventTargeting } from './EventBoard'
import { FactionIntelPanel, type SpecialActionControls } from './FactionIntelPanel'
import { PlayerStrip, type PlayerTargeting } from './PlayerStrip'
import { PrivateHand, type HandActionControls } from './PrivateHand'
import { RiftMark } from './icons'

interface AppShellProps {
  /** Null until a participant state has been loaded for this game. */
  readonly view: BoardView | null
  readonly status: GameStateStatus
  readonly onRetry: () => void
  readonly handSelection?: HandSelectionSession
  readonly illustrationSkin?: IllustrationSkin
  /** The caller's action-round session; null on a game page without the caller's own seat. */
  readonly action?: ActionSubmissionSession | null
}

function LoadError({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return (
    <p className="board-error" role="alert">
      {message}{' '}
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </p>
  )
}

function PhaseDeadline({ header }: { readonly header: BoardHeader }) {
  // Local expiry is display-only: the phase changes when the server reports it.
  const secondsRemaining = useDeadlineCountdown(header.deadline)
  return (
    <div className="deadline-block">
      <span>{header.phaseLabel}</span>
      {secondsRemaining !== null && <strong aria-label="Time remaining">{formatCountdown(secondsRemaining)}</strong>}
      <i aria-hidden="true" />
    </div>
  )
}

interface BoardControls {
  readonly hand: HandActionControls
  readonly specials: SpecialActionControls
  readonly events: EventTargeting | null
  readonly players: PlayerTargeting | null
}

/** Wires the board's areas to the caller's draft while they can still act in the open round. */
function boardControlsFor(action: ActionSubmissionSession, round: OpenActionRoundView, selection: ActionSelection): BoardControls {
  const { choice, targetMode, coordinates, listSize } = selection
  const disabled = action.submitPhase.kind === 'submitting'
  const targeting = targetMode && { targetMode, coordinates, disabled }
  return {
    hand: {
      selectedCardInstanceId: choice?.kind === 'card' ? choice.card.cardInstanceId : null,
      selectableCardIds: new Set(round.hand.filter((card) => card.isPlayableThisRound).map((card) => card.cardInstanceId)),
      disabled,
      onSelect: (cardInstanceId) => action.selectCard(cardInstanceId),
    },
    specials: {
      selectedSpecial: choice?.kind === 'special' ? choice.special.specialAction : null,
      options: round.specials,
      disabled,
      onSelect: (specialAction) => action.selectSpecial(specialAction),
    },
    events: targeting && {
      ...targeting,
      onPickEvent: (eventId) => action.retarget(pickEvent(targetMode, coordinates, eventId, listSize)),
      onPickOutcome: (eventId, outcomeId) => action.retarget(pickOutcome(targetMode, coordinates, eventId, outcomeId)),
    },
    players: targeting && {
      ...targeting,
      opponents: round.opponents,
      onPickPlayer: (playerId) => action.retarget(pickPlayer(targetMode, coordinates, playerId, listSize)),
    },
  }
}

/**
 * During an open action round the whole board is where the caller composes their action. The wrapper
 * stays mounted across phases so the board keeps its DOM (and focus) when a round opens or closes.
 */
function ActionSurface({ round, children }: { readonly round: OpenActionRoundView | null; readonly children: ReactNode }) {
  return (
    <section className="action-surface" aria-label={round ? 'Your action' : undefined}>
      {round && (
        <p className="action-prompt">
          Era {round.eraNumber} · Round {round.roundNumber} · one card or one special this round, or pass
        </p>
      )}
      {children}
    </section>
  )
}

export function AppShell({ view, status, onRetry, handSelection, illustrationSkin = 'board', action = null }: AppShellProps) {
  const failure = status.kind === 'failed' || status.kind === 'stalled' ? status : null

  if (!view) {
    return (
      <section className="app-shell board-unavailable" aria-label="Game board">
        {failure ? <LoadError message={failure.message} onRetry={onRetry} /> : <p>Loading the game…</p>}
      </section>
    )
  }

  const round = action?.view.kind === 'open' ? action.view : null
  const canAct = action !== null && round !== null && !round.hasSubmitted && action.submitPhase.kind !== 'awaiting-projection'
  const decision = canAct ? { round, selection: actionSelectionFor(round, action.draft) } : null
  const controls = action && decision ? boardControlsFor(action, decision.round, decision.selection) : null

  const { header } = view
  return (
    <div className="app-shell">
      <header className="game-header">
        <div className="brand-lockup">
          <RiftMark />
          <div>
            <h1>Temporal Rift</h1>
            <p>Multiplayer strategy</p>
          </div>
        </div>
        <div className="phase-pills" aria-label="Current game phase">
          <span>Era {header.eraNumber}</span>
          {header.round && (
            <span>
              Round {header.round.number} of {header.round.of}
            </span>
          )}
        </div>
        <PhaseDeadline header={header} />
      </header>
      {failure && <LoadError message={failure.message} onRetry={onRetry} />}

      <ActionSurface round={round}>
        <PlayerStrip players={view.players} targeting={controls?.players} />
        <main className="game-board-layout">
          <FactionIntelPanel faction={view.faction} illustrationSkin={illustrationSkin} action={controls?.specials} />
          <EventBoard events={view.events} illustrationSkin={illustrationSkin} targeting={controls?.events} />
          <PrivateHand hand={view.hand} handSelection={handSelection} illustrationSkin={illustrationSkin} action={controls?.hand} />
          <ActionRail roundStatus={view.roundStatus} action={action} decision={decision} illustrationSkin={illustrationSkin} />
        </main>
      </ActionSurface>
    </div>
  )
}
