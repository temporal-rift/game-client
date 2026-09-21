/**
 * Builds the action-round display view from authoritative game state. `raw`
 * carries `myHand`/`activeEvents`/`mySpecialActions`/`myJammedUntilRound`/
 * `players` unparsed (the shared game-state client only validates the
 * reconciliation envelope), so this module parses its own slice — mirroring
 * how `resultsView.ts` reads `state.raw['players']` for its own feature.
 */

import { CARD_GRADES, CARD_TYPES, SPECIAL_ACTIONS } from '../api/actionClient'
import type { CardGrade, CardType, Faction, SpecialAction } from '../api/actionClient'
import type { GameStateView } from '../api/gameStateClient'
import { hasAcceptedSubmission } from '../game/reconciliation'
import {
  cardDisplayName,
  cardEffectSummary,
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

export type ActionRoundView =
  | { readonly kind: 'unavailable'; readonly reason: string }
  | {
      readonly kind: 'open'
      readonly gameId: string
      readonly eraNumber: number
      readonly roundNumber: number
      readonly hasSubmitted: boolean
      readonly hand: readonly HandCardOption[]
      readonly specials: readonly SpecialActionOption[]
      readonly activeEvents: readonly ActiveEventOption[]
      readonly opponents: readonly OpponentOption[]
    }

const KNOWN_CARD_TYPES: ReadonlySet<string> = new Set(CARD_TYPES)
const KNOWN_GRADES: ReadonlySet<string> = new Set(CARD_GRADES)
const KNOWN_SPECIAL_ACTIONS: ReadonlySet<string> = new Set(SPECIAL_ACTIONS)
const KNOWN_CARRY_OVER_STATES: ReadonlySet<string> = new Set(['FRESH', 'CASCADED', 'STALLED'])

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function parseCardType(value: unknown): CardType | null {
  return typeof value === 'string' && KNOWN_CARD_TYPES.has(value) ? (value as CardType) : null
}

function parseGrade(value: unknown): CardGrade | null {
  return typeof value === 'string' && KNOWN_GRADES.has(value) ? (value as CardGrade) : null
}

function parseSpecialAction(value: unknown): SpecialAction | null {
  return typeof value === 'string' && KNOWN_SPECIAL_ACTIONS.has(value) ? (value as SpecialAction) : null
}

function parseHand(value: unknown): readonly HandCardOption[] {
  if (!Array.isArray(value)) {
    return []
  }
  const hand: HandCardOption[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const cardInstanceId = stringField(source['cardInstanceId'])
    const cardType = parseCardType(source['cardType'])
    const grade = parseGrade(source['grade'])
    if (!cardInstanceId || !cardType || !grade) {
      continue
    }
    hand.push({
      cardInstanceId,
      cardType,
      grade,
      name: cardDisplayName(cardType),
      effectSummary: cardEffectSummary(cardType),
      targetMode: cardTargetMode(cardType),
      isPlayableThisRound: source['isPlayableThisRound'] === true,
    })
  }
  return hand
}

function parseOutcomes(value: unknown): readonly EventOutcomeOption[] {
  if (!Array.isArray(value)) {
    return []
  }
  const outcomes: EventOutcomeOption[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const outcomeId = stringField(source['outcomeId'])
    const description = stringField(source['description'])
    if (!outcomeId || !description) {
      continue
    }
    outcomes.push({ outcomeId, description })
  }
  return outcomes
}

function parseActiveEvents(value: unknown): readonly ActiveEventOption[] {
  if (!Array.isArray(value)) {
    return []
  }
  const events: ActiveEventOption[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const eventId = stringField(source['eventId'])
    const title = stringField(source['title'])
    const carryOverState = source['carryOverState']
    if (!eventId || !title || typeof carryOverState !== 'string' || !KNOWN_CARRY_OVER_STATES.has(carryOverState)) {
      continue
    }
    events.push({
      eventId,
      title,
      carryOverState: carryOverState as ActiveEventOption['carryOverState'],
      outcomes: parseOutcomes(source['outcomes']),
    })
  }
  return events
}

function parseMySpecialActions(value: unknown): readonly SpecialAction[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry) => {
    const parsed = parseSpecialAction(entry)
    return parsed ? [parsed] : []
  })
}

function parseOpponents(value: unknown, ownPlayerId: string | null): readonly OpponentOption[] {
  if (!Array.isArray(value)) {
    return []
  }
  const opponents: OpponentOption[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const playerId = stringField(source['playerId'])
    const playerName = stringField(source['playerName'])
    if (!playerId || !playerName || playerId === ownPlayerId) {
      continue
    }
    opponents.push({ playerId, playerName, isConnected: source['isConnected'] === true })
  }
  return opponents
}

function specialOptionsFor(
  faction: Faction | null,
  mySpecialActions: readonly SpecialAction[],
  roundNumber: number | null,
  myJammedUntilRound: number | null,
  budgets: GameStateView['mySpecialBudgets'],
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
  if (state.roundNumber === null) {
    return { kind: 'unavailable', reason: 'No action round is currently open.' }
  }

  const raw = state.raw
  const faction = typeof state.myFaction === 'string' && (state.myFaction as string).length > 0 ? (state.myFaction as Faction) : null
  const myJammedUntilRound = typeof raw['myJammedUntilRound'] === 'number' ? (raw['myJammedUntilRound'] as number) : null

  return {
    kind: 'open',
    gameId: state.gameId,
    eraNumber: state.eraNumber,
    roundNumber: state.roundNumber,
    hasSubmitted: hasAcceptedSubmission(state, { eraNumber: state.eraNumber, kind: 'ACTION', roundNumber: state.roundNumber }),
    hand: parseHand(raw['myHand']),
    specials: specialOptionsFor(faction, parseMySpecialActions(raw['mySpecialActions']), state.roundNumber, myJammedUntilRound, state.mySpecialBudgets),
    activeEvents: parseActiveEvents(raw['activeEvents']),
    opponents: parseOpponents(raw['players'], ownPlayerId),
  }
}
