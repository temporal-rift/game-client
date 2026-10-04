import type { ReactNode } from 'react'
import { actionSelectionFor, pickEvent, pickOutcome, pickPlayer, type ActionSelection, type OpenActionRoundView } from '../action/actionTargeting'
import type { ActionSubmissionSession } from '../action/useActionSubmission'
import type { BoardHeader, BoardView } from '../board/boardView'
import type { GameStateStatus } from '../game/useGameState'
import { formatCountdown, useDeadlineCountdown } from '../game/useDeadlineCountdown'
import type { HandSelectionSession } from '../hand/useHandSelection'
import type { IllustrationSkin } from '../illustrations/catalogData'
import type { ParadoxResolutionView } from '../paradox/paradoxView'
import type { ParadoxResolutionSession } from '../paradox/useParadoxResolution'
import type { ResultsSession } from '../results/useResults'
import type { RoundSummaryView } from '../round-summary/roundSummaryView'
import { BoardDecisionAreas, type BoardDecisionSessions } from './BoardDecisionAreas'
import { BoardRoundSummary } from './BoardRoundSummary'
import { ResultsPanel } from './ResultsPanel'
import { ActionRail } from './ActionRail'
import { EventBoard, type EventParadoxMarking, type EventTargeting } from './EventBoard'
import { FactionIntelPanel, type SpecialActionControls } from './FactionIntelPanel'
import { PlayerStrip, type PlayerTargeting } from './PlayerStrip'
import { PrivateHand, type HandActionControls, type ResolutionCardControls } from './PrivateHand'
import { RiftMark } from './icons'
import { PlayerReference } from './PlayerReference'
import { PhaseGuide } from './PhaseGuide'

interface AppShellProps extends BoardDecisionSessions {
  /** Null until a participant state has been loaded for this game. */
  readonly view: BoardView | null
  readonly status: GameStateStatus
  readonly onRetry: () => void
  readonly handSelection?: HandSelectionSession
  readonly illustrationSkin?: IllustrationSkin
  /** The caller's action-round session; null on a game page without the caller's own seat. */
  readonly action?: ActionSubmissionSession | null
  readonly roundSummary?: RoundSummaryView
  readonly results?: ResultsSession
  readonly ownPlayerId?: string | null
  /** The caller's paradox-resolution session; null on a game page without the caller's own seat. */
  readonly paradox?: ParadoxResolutionSession | null
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
      <span>{header.phaseLabel}{header.deadline !== null && ' · decision limit'}</span>
      {secondsRemaining !== null && <strong aria-label="Time remaining">{formatCountdown(secondsRemaining)}</strong>}
      {secondsRemaining !== null && secondsRemaining > 0 && secondsRemaining <= 30 && <small role="status" className="limit-warning">Decision limit approaching</small>}
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

function actionDecisionFor(action: ActionSubmissionSession | null, round: OpenActionRoundView | null) {
  if (!action || !round || round.hasSubmitted || action.submitPhase.kind === 'awaiting-projection') return null
  return { round, selection: actionSelectionFor(round, action.draft) }
}

type ParadoxPhaseView = Exclude<ParadoxResolutionView, { readonly kind: 'unavailable' }>

interface ParadoxControls {
  readonly events: EventParadoxMarking
  readonly cards: ResolutionCardControls | null
}

/** Marks the open phase on the board and, while the caller can still choose, wires their card and target. */
function paradoxControlsFor(paradox: ParadoxResolutionSession, phase: ParadoxPhaseView, canResolve: boolean): ParadoxControls {
  const { draft } = paradox
  const disabled = paradox.submitPhase.kind === 'submitting'
  const selectedCardInstanceId = draft.kind === 'card' ? draft.cardInstanceId : null
  return {
    events: {
      affectedEventIds: new Set(phase.affectedEvents.map((event) => event.eventId)),
      paradoxes: phase.paradoxes,
      targeting: canResolve && draft.kind === 'card' ? { chosen: draft.target, disabled, onPickOutcome: paradox.selectTarget } : null,
    },
    cards:
      canResolve && phase.kind === 'open'
        ? { cards: phase.cards, selectedCardInstanceId, disabled, onSelect: paradox.selectCard }
        : null,
  }
}

function surfaceFor(round: OpenActionRoundView | null, paradoxPhase: ParadoxPhaseView | null): { readonly label: string; readonly prompt: string } | null {
  if (round) {
    return { label: 'Your action', prompt: `Era ${round.eraNumber} · Round ${round.roundNumber} · one card or one special this round, or pass` }
  }
  if (paradoxPhase) {
    return { label: 'Paradox resolution', prompt: `Era ${paradoxPhase.eraNumber} · Paradox resolution · one eligible card on an affected event, or pass` }
  }
  return null
}

/**
 * During an open action round or paradox-resolution phase the whole board is where the caller makes their
 * choice. The wrapper stays mounted across phases so the board keeps its DOM (and focus) when a window opens
 * or closes.
 */
function DecisionSurface({ surface, children }: { readonly surface: { readonly label: string; readonly prompt: string } | null; readonly children: ReactNode }) {
  return (
    <section className="action-surface" aria-label={surface?.label}>
      {surface && <p className="action-prompt">{surface.prompt}</p>}
      {children}
    </section>
  )
}

export function AppShell({
  view, status, onRetry, handSelection, illustrationSkin = 'board', action = null, paradox = null,
  roundSummary, results, ownPlayerId = null, declaration,
}: AppShellProps) {
  const failure = status.kind === 'failed' || status.kind === 'stalled' ? status : null

  if (!view) {
    return (
      <section className="app-shell board-unavailable" aria-label="Game board">
        {failure ? <LoadError message={failure.message} onRetry={onRetry} /> : <p>Loading the game…</p>}
      </section>
    )
  }

  const round = action?.view.kind === 'open' ? action.view : null
  const decision = actionDecisionFor(action, round)
  const controls = action && decision ? boardControlsFor(action, decision.round, decision.selection) : null
  const paradoxPhase = paradox && paradox.view.kind !== 'unavailable' ? paradox.view : null
  const canResolve = paradoxPhase?.kind === 'open' && paradox?.submitPhase.kind !== 'awaiting-projection'
  const paradoxControls = paradox && paradoxPhase ? paradoxControlsFor(paradox, paradoxPhase, canResolve) : null

  const terminal = results && results.view.kind !== 'active'
  const { header } = view
  return (
    <section className="app-shell" aria-label="Game board">
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
      <PlayerReference faction={view.faction.faction} />
      {!terminal && <PhaseGuide view={view} handSelection={handSelection} declaration={declaration} decisionPending={action?.submitPhase.kind === 'submitting' || action?.submitPhase.kind === 'awaiting-projection' || paradox?.submitPhase.kind === 'submitting' || paradox?.submitPhase.kind === 'awaiting-projection'} />}

      <BoardDecisionAreas declaration={declaration} />
      <DecisionSurface surface={surfaceFor(round, paradoxPhase)}>
        {roundSummary && <BoardRoundSummary view={roundSummary} />}
        <PlayerStrip players={view.players} targeting={controls?.players} />
        <main className={terminal ? 'game-board-layout has-results' : 'game-board-layout'}>
          <FactionIntelPanel faction={view.faction} illustrationSkin={illustrationSkin} action={controls?.specials} />
          {terminal ? (
            <ResultsPanel view={results.view} ownPlayerId={ownPlayerId} error={results.message} isRefreshing={results.isRefreshing} onRefresh={() => void results.refresh()} />
          ) : (
            <>
              <EventBoard events={view.events} illustrationSkin={illustrationSkin} targeting={controls?.events} paradox={paradoxControls?.events} />
              <PrivateHand
                hand={view.hand}
                handSelection={handSelection}
                illustrationSkin={illustrationSkin}
                action={controls?.hand}
                resolution={paradoxControls?.cards}
              />
            </>
          )}
          <ActionRail
            roundStatus={view.roundStatus}
            action={action}
            decision={decision}
            paradox={paradox}
            canResolve={canResolve}
            illustrationSkin={illustrationSkin}
          />
        </main>
      </DecisionSurface>
    </section>
  )
}
