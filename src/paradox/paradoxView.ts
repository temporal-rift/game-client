import type { EligibleResolutionCard, GameStateView, MySubmission, ParadoxType } from '../api/projection'
import { activeEventOptions, type ActiveEventOption } from '../action/actionView'
import { cardDisplayName, cardEffectSummary } from '../action/actionRules'
import { describeTargets } from '../action/actionTargeting'

export interface ParadoxCardOption extends EligibleResolutionCard {
  readonly name: string
  readonly effectSummary: string
}

/** One paradox pending in the open phase, as every participant sees it. */
export interface OpenParadoxView {
  readonly paradoxId: string
  readonly type: ParadoxType
  readonly typeLabel: string
  readonly affectedEventId: string
  readonly affectedOutcomeIds: readonly string[]
}

/** The caller's accepted choice for the phase, as the server recorded it. */
export interface AcceptedResolution {
  readonly summary: string
  readonly targets: readonly string[]
}

/** Public facts of an open phase, shared by every participant whether or not they have chosen. */
interface ParadoxPhaseFacts {
  readonly gameId: string
  readonly eraNumber: number
  readonly deadline: string | null
  readonly submittedCount: number | null
  readonly totalPlayers: number | null
  readonly affectedEvents: readonly ActiveEventOption[]
  readonly paradoxes: readonly OpenParadoxView[]
}

export type ParadoxResolutionView =
  | { readonly kind: 'unavailable'; readonly reason: string }
  | (ParadoxPhaseFacts & { readonly kind: 'submitted'; readonly acceptedChoice: AcceptedResolution })
  | (ParadoxPhaseFacts & { readonly kind: 'open'; readonly cards: readonly ParadoxCardOption[] })

const PARADOX_TYPE_LABELS: Readonly<Record<ParadoxType, string>> = {
  DEAD_HEAT: 'Dead Heat',
  IMPOSSIBLE_ERASURE: 'Impossible Erasure',
  CHAIN_CONFLICT: 'Chain Conflict',
}

export function paradoxTypeLabel(type: ParadoxType): string {
  return PARADOX_TYPE_LABELS[type]
}

function isParadoxPhase(state: GameStateView): boolean {
  return state.phase === 'PARADOX_RESOLUTION' && Boolean(state.phaseContext?.paradoxOpen)
}

function phaseFacts(state: GameStateView): ParadoxPhaseFacts {
  const context = state.phaseContext
  const progress = context?.paradoxResolutionProgress
  const affectedEventIds = new Set(context?.affectedEventIds ?? [])
  return {
    gameId: state.gameId,
    eraNumber: state.eraNumber,
    deadline: state.deadlines?.paradoxResolutionExpiresAt ?? null,
    submittedCount: progress?.submittedCount ?? null,
    totalPlayers: progress?.totalPlayers ?? null,
    affectedEvents: activeEventOptions(state.activeEvents).filter((event) => affectedEventIds.has(event.eventId)),
    paradoxes: (context?.paradoxes ?? []).map(({ paradoxId, type, affectedEventId, affectedOutcomeIds }) => ({
      paradoxId,
      type,
      typeLabel: paradoxTypeLabel(type),
      affectedEventId,
      affectedOutcomeIds,
    })),
  }
}

function acceptedResolutionFor(submission: MySubmission, events: readonly ActiveEventOption[]): AcceptedResolution {
  if (submission.choice === 'PASS' || !submission.card) {
    return { summary: 'Pass', targets: [] }
  }
  const { targetEventId, targetOutcomeId } = submission.targets ?? {}
  return {
    summary: `${cardDisplayName(submission.card.cardType)} · Grade ${submission.card.grade}`,
    targets: describeTargets({ targetEventId, targetOutcomeId }, { events, opponents: [] }),
  }
}

/** Builds the reactive-resolution view entirely from the caller's game-state projection. */
export function selectParadoxResolutionView(state: GameStateView | null): ParadoxResolutionView {
  if (!state || !isParadoxPhase(state)) {
    return { kind: 'unavailable', reason: 'No paradox-resolution phase is currently open.' }
  }

  const facts = phaseFacts(state)
  const submission = (state.mySubmissions ?? []).find(
    (entry) => entry.window === 'PARADOX_RESOLUTION' && entry.eraNumber === state.eraNumber,
  )
  if (submission) {
    return { ...facts, kind: 'submitted', acceptedChoice: acceptedResolutionFor(submission, activeEventOptions(state.activeEvents)) }
  }

  return {
    ...facts,
    kind: 'open',
    cards: (state.myEligibleResolutionCards ?? []).map((card) => ({
      ...card,
      name: cardDisplayName(card.cardType),
      effectSummary: cardEffectSummary(card.cardType),
    })),
  }
}
