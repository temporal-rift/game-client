/**
 * Builds the illustrated board's view from the caller's authoritative,
 * contract-validated game state. Only entitled fields are read: other
 * players' factions appear only once the server reveals them, outcomes carry
 * public bands (never weights), and round status reports who has decided,
 * never what anyone submitted.
 */

import { cardDisplayName, cardEffectSummary, specialDisplayName } from '../action/actionRules'
import type { CardGrade, CardType, Faction, SpecialAction } from '../api/action'
import { ACTION_ROUNDS_PER_ERA, type ActiveEvent, type GameStateView, type Phase, type PublicBandEvent, type SubmissionProgress } from '../api/projection'
import { nameFor, playerNameLookup } from '../game/playerNames'
import { toProbabilityBand, type ProbabilityBand } from '../game/publicBands'

export interface BoardHeader {
  readonly eraNumber: number
  readonly phaseLabel: string
  readonly round: { readonly number: number; readonly of: number } | null
  /** The server's expiry for the current phase; display-only, never a phase transition. */
  readonly deadline: string | null
}

export interface BoardPlayer {
  readonly playerId: string
  readonly name: string
  readonly score: number
  readonly isCurrentPlayer: boolean
  /** Null while the faction is hidden from the caller. */
  readonly factionName: string | null
}

export interface BoardSpecial {
  readonly specialAction: SpecialAction
  readonly name: string
  readonly remainingThisEra: number | null
  readonly remainingThisGame: number | null
}

export interface BoardFaction {
  readonly faction: Faction | null
  readonly factionName: string | null
  readonly score: number
  readonly winScoreThreshold: number
  readonly specials: readonly BoardSpecial[]
}

export interface BoardOutcome {
  readonly outcomeId: string
  readonly description: string
  readonly band: ProbabilityBand
}

export interface BoardEvent {
  readonly eventId: string
  readonly title: string
  readonly carryOverState: ActiveEvent['carryOverState']
  /** Round whose close produced the shown bands; null while none are published. */
  readonly bandsObservedInRound: number | null
  readonly outcomes: readonly BoardOutcome[]
}

export interface BoardRoundStatus {
  readonly submittedCount: number
  readonly totalPlayers: number
  /** Null when the caller's player id is unknown. */
  readonly hasSubmitted: boolean | null
}

export interface BoardHandCard {
  readonly cardInstanceId: string
  readonly cardType: CardType
  readonly name: string
  readonly grade: CardGrade
  readonly effect: string
  readonly isPlayableThisRound: boolean
}

export interface BoardView {
  readonly gameId: string
  readonly header: BoardHeader
  readonly players: readonly BoardPlayer[]
  readonly faction: BoardFaction
  readonly events: readonly BoardEvent[]
  /** Null while no decision window reports progress. */
  readonly roundStatus: BoardRoundStatus | null
  readonly hand: readonly BoardHandCard[]
}

const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  LOBBY: 'Lobby',
  ERA_START: 'Era start',
  HAND_SELECTION: 'Hand selection',
  ACTION_ROUND_1: 'Action round',
  ACTION_ROUND_2: 'Action round',
  ACTION_ROUND_3: 'Action round',
  PARADOX_RESOLUTION: 'Paradox resolution',
  RESOLUTION: 'Resolution',
  ERA_END: 'Era end',
  GAME_ENDED: 'Game ended',
}

function isActionRound(phase: Phase): boolean {
  return phase.startsWith('ACTION_ROUND_')
}

export function factionDisplayName(faction: Faction): string {
  return faction.charAt(0) + faction.slice(1).toLowerCase()
}

function deadlineFor(state: GameStateView): string | null {
  const deadlines = state.deadlines
  if (state.phase === 'HAND_SELECTION') return deadlines?.handSelectionExpiresAt ?? null
  if (isActionRound(state.phase)) return deadlines?.actionRoundExpiresAt ?? null
  if (state.phase === 'PARADOX_RESOLUTION') return deadlines?.paradoxResolutionExpiresAt ?? null
  return null
}

function headerFrom(state: GameStateView): BoardHeader {
  const roundNumber = state.roundNumber ?? null
  const showsRound = isActionRound(state.phase) || state.phase === 'PARADOX_RESOLUTION'
  return {
    eraNumber: state.eraNumber,
    phaseLabel: PHASE_LABELS[state.phase],
    round: showsRound && roundNumber !== null ? { number: roundNumber, of: ACTION_ROUNDS_PER_ERA } : null,
    deadline: deadlineFor(state),
  }
}

function playersFrom(state: GameStateView, currentPlayerId: string | null): readonly BoardPlayer[] {
  const names = playerNameLookup(state)
  return state.players.map(({ playerId, score, faction }) => {
    const isCurrentPlayer = playerId === currentPlayerId
    const visibleFaction = isCurrentPlayer ? (state.myFaction ?? faction ?? null) : (faction ?? null)
    return {
      playerId,
      name: nameFor(playerId, names),
      score,
      isCurrentPlayer,
      factionName: visibleFaction ? factionDisplayName(visibleFaction) : null,
    }
  })
}

function factionFrom(state: GameStateView): BoardFaction {
  const faction = state.myFaction ?? null
  const budgets = new Map((state.mySpecialBudgets ?? []).map((budget) => [budget.specialAction, budget]))
  return {
    faction,
    factionName: faction ? factionDisplayName(faction) : null,
    score: state.myScore,
    winScoreThreshold: state.winScoreThreshold,
    specials: faction
      ? (state.mySpecialActions ?? []).map((specialAction) => {
          const budget = budgets.get(specialAction)
          return {
            specialAction,
            name: specialDisplayName(specialAction),
            remainingThisEra: budget?.remainingUsesThisEra ?? null,
            remainingThisGame: budget?.remainingUsesThisGame ?? null,
          }
        })
      : [],
  }
}

function eventsFrom(state: GameStateView): readonly BoardEvent[] {
  const bandsByEvent = new Map<string, PublicBandEvent>((state.publicBands ?? []).map((bands) => [bands.eventId, bands]))
  return state.activeEvents.map(({ eventId, title, carryOverState, outcomes }) => {
    const bands = bandsByEvent.get(eventId)
    const bandByOutcome = new Map((bands?.outcomes ?? []).map(({ outcomeId, band }) => [outcomeId, toProbabilityBand(band)]))
    return {
      eventId,
      title,
      carryOverState,
      bandsObservedInRound: bands?.observedInRound ?? null,
      outcomes: outcomes.map(({ outcomeId, description }) => ({
        outcomeId,
        description,
        band: bandByOutcome.get(outcomeId) ?? 'unknown',
      })),
    }
  })
}

function openWindowProgress(state: GameStateView): SubmissionProgress | undefined {
  if (isActionRound(state.phase)) return state.phaseContext?.actionRoundProgress
  if (state.phase === 'PARADOX_RESOLUTION') return state.phaseContext?.paradoxResolutionProgress
  return undefined
}

function roundStatusFrom(state: GameStateView, currentPlayerId: string | null): BoardRoundStatus | null {
  const progress = openWindowProgress(state)
  if (!progress) return null
  return {
    submittedCount: progress.submittedCount,
    totalPlayers: progress.totalPlayers,
    hasSubmitted: currentPlayerId === null ? null : !progress.pendingPlayerIds.includes(currentPlayerId),
  }
}

function handFrom(state: GameStateView): readonly BoardHandCard[] {
  return state.myHand.map(({ cardInstanceId, cardType, grade, isPlayableThisRound }) => ({
    cardInstanceId,
    cardType,
    name: cardDisplayName(cardType),
    grade,
    effect: cardEffectSummary(cardType),
    isPlayableThisRound,
  }))
}

/** `currentPlayerId` is the caller's lobby player id, or null when the lobby does not identify it. */
export function toBoardView(state: GameStateView, currentPlayerId: string | null): BoardView {
  return {
    gameId: state.gameId,
    header: headerFrom(state),
    players: playersFrom(state, currentPlayerId),
    faction: factionFrom(state),
    events: eventsFrom(state),
    roundStatus: roundStatusFrom(state, currentPlayerId),
    hand: handFrom(state),
  }
}
