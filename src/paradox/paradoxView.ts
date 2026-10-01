import type { EligibleResolutionCard, GameStateView } from '../api/projection'
import { activeEventOptions, type ActiveEventOption } from '../action/actionView'
import { cardDisplayName, cardEffectSummary } from '../action/actionRules'
import { hasAcceptedSubmission } from '../game/reconciliation'

export interface ParadoxCardOption extends EligibleResolutionCard {
  readonly name: string
  readonly effectSummary: string
}

export type ParadoxResolutionView =
  | { readonly kind: 'unavailable'; readonly reason: string }
  | {
      readonly kind: 'submitted'
      readonly eraNumber: number
      readonly submittedCount: number | null
      readonly totalPlayers: number | null
      readonly deadline: string | null
    }
  | {
      readonly kind: 'open'
      readonly gameId: string
      readonly eraNumber: number
      readonly deadline: string | null
      readonly submittedCount: number | null
      readonly totalPlayers: number | null
      readonly affectedEvents: readonly ActiveEventOption[]
      readonly cards: readonly ParadoxCardOption[]
    }

function isParadoxPhase(state: GameStateView): boolean {
  return state.phase === 'PARADOX_RESOLUTION' && Boolean(state.phaseContext?.paradoxOpen)
}

/** Builds the reactive-resolution view entirely from the caller's game-state projection. */
export function selectParadoxResolutionView(state: GameStateView | null): ParadoxResolutionView {
  if (!state || !isParadoxPhase(state)) {
    return { kind: 'unavailable', reason: 'No paradox-resolution phase is currently open.' }
  }

  const progress = state.phaseContext?.paradoxResolutionProgress
  const deadline = state.deadlines?.paradoxResolutionExpiresAt ?? null
  if (hasAcceptedSubmission(state, { eraNumber: state.eraNumber, window: 'PARADOX_RESOLUTION' })) {
    return {
      kind: 'submitted',
      eraNumber: state.eraNumber,
      submittedCount: progress?.submittedCount ?? null,
      totalPlayers: progress?.totalPlayers ?? null,
      deadline,
    }
  }

  const affectedEventIds = new Set(state.phaseContext?.affectedEventIds ?? [])
  return {
    kind: 'open',
    gameId: state.gameId,
    eraNumber: state.eraNumber,
    deadline,
    submittedCount: progress?.submittedCount ?? null,
    totalPlayers: progress?.totalPlayers ?? null,
    affectedEvents: activeEventOptions(state.activeEvents).filter((event) => affectedEventIds.has(event.eventId)),
    cards: (state.myEligibleResolutionCards ?? []).map((card) => ({
      ...card,
      name: cardDisplayName(card.cardType),
      effectSummary: cardEffectSummary(card.cardType),
    })),
  }
}
