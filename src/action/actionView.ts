/**
 * Builds the action-round display view from authoritative, contract-validated
 * game state: the caller's hand, owned specials with their availability, the
 * current era's active events, and opponents to target.
 */

import { isCardType, isFaction, isSpecialAction, type ActionCoordinates, type CardGrade, type CardType, type Faction, type SpecialAction } from '../api/action'
import type { ActiveEvent, GameStateView, MySubmission, PlayerInGame, SpecialBudget } from '../api/projection'
import { hasAcceptedSubmission } from '../game/reconciliation'
import { describeTargets } from './actionTargeting'
import {
  cardDisplayName,
  cardEffectSummary,
  cardTargetListSize,
  cardTargetMode,
  FACTION_SPECIALS,
  isDeclarationOnlySpecial,
  specialActionAvailability,
  specialDisplayName,
  specialEffectSummary,
  specialTargetMode,
  type TargetMode,
} from './actionRules'

export interface HandCardOption {
  readonly cardInstanceId: string
  readonly cardType: CardType
  readonly grade: CardGrade
  readonly name: string
  readonly effectSummary: string
  readonly targetMode: TargetMode
  /** Entries a list target mode names at this card's grade; null for scalar target modes. */
  readonly targetListSize: number | null
  readonly isPlayableThisRound: boolean
}

export interface EventOutcomeOption {
  readonly outcomeId: string
  readonly description: string
}

export interface ActiveEventOption {
  readonly eventId: string
  readonly title: string
  readonly carryOverState: 'FRESH' | 'CASCADED' | 'STALLED'
  readonly outcomes: readonly EventOutcomeOption[]
}

export interface SpecialActionOption {
  readonly specialAction: SpecialAction
  readonly name: string
  readonly effectSummary: string
  readonly targetMode: TargetMode
  readonly available: boolean
  readonly unavailableReason: string | null
  readonly remainingUsesThisEra: number | null
  readonly remainingUsesThisGame: number | null
}

export interface OpponentOption {
  readonly playerId: string
  readonly playerName: string
  readonly isConnected: boolean
}

/** The caller's accepted decision for the open round, as the server recorded it. */
export interface AcceptedDecision {
  readonly summary: string
  readonly targets: readonly string[]
}

export type ActionRoundView =
  | { readonly kind: 'unavailable'; readonly reason: string }
  | {
      readonly kind: 'open'
      readonly gameId: string
      readonly eraNumber: number
      readonly roundNumber: number
      readonly hasSubmitted: boolean
      /** Null until an accepted decision for this round is recorded in game state. */
      readonly acceptedDecision: AcceptedDecision | null
      readonly submittedCount: number | null
      readonly totalPlayers: number | null
      readonly deadline: string | null
      readonly hand: readonly HandCardOption[]
      readonly specials: readonly SpecialActionOption[]
      readonly activeEvents: readonly ActiveEventOption[]
      readonly opponents: readonly OpponentOption[]
    }

function handOptions(hand: GameStateView['myHand']): readonly HandCardOption[] {
  return hand.flatMap(({ cardInstanceId, cardType, grade, isPlayableThisRound }) => {
    if (!isCardType(cardType)) {
      return []
    }
    const targetMode = cardTargetMode(cardType)
    const targetListSize = cardTargetListSize(cardType, grade)
    if ((targetMode === 'EVENT_LIST' || targetMode === 'PLAYER_LIST') && targetListSize === null) {
      return []
    }
    return [
      {
        cardInstanceId,
        cardType,
        grade,
        name: cardDisplayName(cardType),
        effectSummary: cardEffectSummary(cardType),
        targetMode,
        targetListSize,
        isPlayableThisRound,
      },
    ]
  })
}

export function activeEventOptions(events: readonly ActiveEvent[]): readonly ActiveEventOption[] {
  return events.map(({ eventId, title, carryOverState, outcomes }) => ({
    eventId,
    title,
    carryOverState,
    outcomes: outcomes.map(({ outcomeId, description }) => ({ outcomeId, description })),
  }))
}

function opponentOptions(players: readonly PlayerInGame[], ownPlayerId: string | null): readonly OpponentOption[] {
  return players.flatMap(({ playerId, playerName, isConnected }, seat) =>
    playerId === ownPlayerId
      ? []
      : // The contract allows a null playerName; an unnamed opponent must stay targetable.
        [{ playerId, playerName: playerName || `Player ${seat + 1}`, isConnected }],
  )
}

function specialOptionsFor(
  faction: Faction | null,
  mySpecialActions: readonly SpecialAction[],
  roundNumber: number | null,
  myJammedUntilRound: number | null,
  budgets: readonly SpecialBudget[],
): readonly SpecialActionOption[] {
  if (!faction) {
    return []
  }
  const owned = new Set(FACTION_SPECIALS[faction])
  return mySpecialActions
    .filter((specialAction) => owned.has(specialAction) && !isDeclarationOnlySpecial(specialAction))
    .map((specialAction) => {
      const availability = specialActionAvailability(specialAction, { roundNumber, myJammedUntilRound, budgets })
      const budget = budgets.find((entry) => entry.specialAction === specialAction) ?? null
      return {
        specialAction,
        name: specialDisplayName(specialAction),
        effectSummary: specialEffectSummary(specialAction),
        targetMode: specialTargetMode(specialAction),
        available: availability.available,
        unavailableReason: availability.reason,
        remainingUsesThisEra: budget?.remainingUsesThisEra ?? null,
        remainingUsesThisGame: budget?.remainingUsesThisGame ?? null,
      }
    })
}

function decisionSummary(submission: MySubmission): string {
  if (submission.choice === 'PASS') {
    return 'Pass'
  }
  if (submission.card) {
    return `${cardDisplayName(submission.card.cardType)} · Grade ${submission.card.grade}`
  }
  if (submission.specialAction) {
    return specialDisplayName(submission.specialAction)
  }
  return 'Action recorded'
}

function acceptedDecisionFor(
  state: GameStateView,
  roundNumber: number,
  activeEvents: readonly ActiveEventOption[],
  opponents: readonly OpponentOption[],
): AcceptedDecision | null {
  const submission = (state.mySubmissions ?? []).find(
    (entry) => entry.window === 'ACTION' && entry.eraNumber === state.eraNumber && entry.roundNumber === roundNumber,
  )
  if (!submission) {
    return null
  }
  const { sourceEventId, sourceOutcomeId, ...targets } = submission.targets ?? {}
  const coordinates: ActionCoordinates = {
    ...targets,
    // A Thread anchor may sit on another event than its target; only a same-event pair reads as From/To.
    sourceOutcomeId: sourceEventId === undefined || sourceEventId === targets.targetEventId ? sourceOutcomeId : undefined,
    disguiseCategory: submission.card?.disguiseCategory,
  }
  return { summary: decisionSummary(submission), targets: describeTargets(coordinates, { events: activeEvents, opponents }) }
}

/**
 * Selects the action-round view for the current participant. `unavailable`
 * covers every phase outside an open action round (no round to act in);
 * `open` carries the caller's own legal card/special options, the current
 * era's active events, and opponents eligible for player-targeting cards
 * and specials.
 */
export function selectActionRoundView(state: GameStateView | null, ownPlayerId: string | null = null): ActionRoundView {
  if (!state) {
    return { kind: 'unavailable', reason: 'Game state is not loaded yet.' }
  }
  if (state.phase !== 'ACTION_ROUND_1' && state.phase !== 'ACTION_ROUND_2' && state.phase !== 'ACTION_ROUND_3') {
    return { kind: 'unavailable', reason: 'No action round is currently open.' }
  }
  if (state.roundNumber === null || state.roundNumber === undefined) {
    return { kind: 'unavailable', reason: 'No action round is currently open.' }
  }

  const faction = isFaction(state.myFaction) ? state.myFaction : null
  const mySpecialActions = (state.mySpecialActions ?? []).filter((action) => isSpecialAction(action))
  const progress = state.phaseContext?.actionRoundProgress
  const activeEvents = activeEventOptions(state.activeEvents)
  const opponents = opponentOptions(state.players, ownPlayerId)

  return {
    kind: 'open',
    gameId: state.gameId,
    eraNumber: state.eraNumber,
    roundNumber: state.roundNumber,
    hasSubmitted: hasAcceptedSubmission(state, { eraNumber: state.eraNumber, window: 'ACTION', roundNumber: state.roundNumber }),
    acceptedDecision: acceptedDecisionFor(state, state.roundNumber, activeEvents, opponents),
    submittedCount: progress?.submittedCount ?? null,
    totalPlayers: progress?.totalPlayers ?? null,
    deadline: state.deadlines?.actionRoundExpiresAt ?? null,
    hand: handOptions(state.myHand),
    specials: specialOptionsFor(faction, mySpecialActions, state.roundNumber, state.myJammedUntilRound ?? null, state.mySpecialBudgets ?? []),
    activeEvents,
    opponents,
  }
}
