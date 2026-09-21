import type { EligibleParadoxCardView, ParadoxResolutionStatusView } from '../api/actionClient'
import type { GameStateView } from '../api/gameStateClient'
import { parseActiveEvents, type ActiveEventOption } from '../action/actionView'
import { cardDisplayName, cardEffectSummary } from '../action/actionRules'
import { hasAcceptedSubmission } from '../game/reconciliation'

export interface ParadoxCardOption extends EligibleParadoxCardView {
  readonly name: string
  readonly effectSummary: string
}

export type ParadoxResolutionView =
  | { readonly kind: 'unavailable'; readonly reason: string }
  | { readonly kind: 'loading' }
  | { readonly kind: 'closed'; readonly reason: string }
  | {
      readonly kind: 'submitted'
      readonly eraNumber: number
      readonly submittedCount: number
      readonly totalPlayers: number
    }
  | {
      readonly kind: 'open'
      readonly gameId: string
      readonly eraNumber: number
      readonly timerRemainingSeconds: number | null
      readonly submittedCount: number
      readonly totalPlayers: number
      readonly affectedEvents: readonly ActiveEventOption[]
      readonly cards: readonly ParadoxCardOption[]
    }

function isParadoxPhase(state: GameStateView): boolean {
  return state.phase === 'PARADOX_RESOLUTION' && state.phaseContext.paradoxOpen
}

/**
 * Builds a player-safe reactive-resolution view solely from the phase status
 * and participant state. In particular, opaque paradox IDs and ordinary hand
 * cards never become selectable targets or offers in the browser.
 */
export function selectParadoxResolutionView(
  state: GameStateView | null,
  status: ParadoxResolutionStatusView | null,
): ParadoxResolutionView {
  if (!state || !isParadoxPhase(state)) {
    return { kind: 'unavailable', reason: 'No paradox-resolution phase is currently open.' }
  }
  if (status?.eraNumber !== state.eraNumber) {
    return { kind: 'loading' }
  }
  if (!status.phaseOpen) {
    return { kind: 'closed', reason: 'The paradox-resolution phase has closed.' }
  }
  if (status.mySubmitted || hasAcceptedSubmission(state, { eraNumber: state.eraNumber, kind: 'PARADOX_CARD' })) {
    return {
      kind: 'submitted',
      eraNumber: state.eraNumber,
      submittedCount: status.submittedCount,
      totalPlayers: status.totalPlayers,
    }
  }
  const affectedEventIds = new Set(status.affectedEventIds)
  return {
    kind: 'open',
    gameId: state.gameId,
    eraNumber: state.eraNumber,
    timerRemainingSeconds: status.timerRemainingSeconds,
    submittedCount: status.submittedCount,
    totalPlayers: status.totalPlayers,
    affectedEvents: parseActiveEvents(state.raw['activeEvents']).filter((event) => affectedEventIds.has(event.eventId)),
    cards: status.eligibleCards.map((card) => ({
      ...card,
      name: cardDisplayName(card.cardType),
      effectSummary: cardEffectSummary(card.cardType),
    })),
  }
}
