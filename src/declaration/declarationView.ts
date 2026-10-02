import type { ActiveEvent, ActivistDeclarationMode, GameStateView } from '../api/projection'
import { activeEventOptions, type ActiveEventOption } from '../action/actionView'
import { hasAcceptedSubmission } from '../game/reconciliation'

export type { ActivistDeclarationMode }

export const DECLARATION_MODES: readonly ActivistDeclarationMode[] = ['RALLY', 'MOMENTUM']

/**
 * Brief, server-neutral explanations for the eligible declaration modes.
 * Scoring, boosts, and eligibility rules stay server-owned; these labels only
 * say what each choice is so the board can explain the offer.
 */
export const DECLARATION_MODE_DESCRIPTIONS: Readonly<Record<ActivistDeclarationMode, string>> = {
  RALLY: 'Publicly back one outcome. Supporting Round 1 transfers onto it are boosted.',
  MOMENTUM: 'Follow-up declaration available after a successful prior-era declaration.',
}

function isDeclarationMode(value: unknown): value is ActivistDeclarationMode {
  return value === 'RALLY' || value === 'MOMENTUM'
}

export function eligibleDeclarationModes(state: GameStateView): readonly ActivistDeclarationMode[] {
  return (state.myEligibleDeclarationModes ?? []).filter(isDeclarationMode)
}

export type DeclarationView =
  | { readonly kind: 'unavailable'; readonly reason: string }
  | {
      readonly kind: 'submitted'
      readonly eraNumber: number
      readonly deadline: string | null
    }
  | {
      readonly kind: 'open'
      readonly gameId: string
      readonly eraNumber: number
      readonly deadline: string | null
      readonly eligibleModes: readonly ActivistDeclarationMode[]
      readonly activeEvents: readonly ActiveEventOption[]
    }

function isDeclarationWindowOpen(state: GameStateView): boolean {
  return Boolean(state.phaseContext?.declarationOpen)
}

/**
 * Selects the declaration view for the current participant. An offer exists
 * only while the server reports an open window and names at least one
 * eligible mode for this caller; the server remains authoritative for
 * eligibility, validation, and expiry. Accepted declarations recover from
 * `mySubmissions` so a reload never offers a second decision.
 */
export function selectDeclarationView(state: GameStateView | null): DeclarationView {
  if (!state) {
    return { kind: 'unavailable', reason: 'Game state is not loaded yet.' }
  }
  if (!isDeclarationWindowOpen(state)) {
    return { kind: 'unavailable', reason: 'No declaration window is currently open.' }
  }
  const deadline = state.deadlines?.declarationExpiresAt ?? null
  if (hasAcceptedSubmission(state, { eraNumber: state.eraNumber, window: 'DECLARATION' })) {
    return { kind: 'submitted', eraNumber: state.eraNumber, deadline }
  }
  const eligibleModes = eligibleDeclarationModes(state)
  if (eligibleModes.length === 0) {
    return { kind: 'unavailable', reason: 'Your faction cannot declare in this window.' }
  }
  return {
    kind: 'open',
    gameId: state.gameId,
    eraNumber: state.eraNumber,
    deadline,
    eligibleModes,
    activeEvents: activeEventOptions(state.activeEvents as readonly ActiveEvent[]),
  }
}
