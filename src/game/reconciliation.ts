/**
 * Pure reconciliation rules shared by every polling feature module: whether
 * a freshly fetched game state may replace what is currently shown, how
 * long to wait before the next poll, and whether the caller's own decision
 * for a coordinate was already accepted (lost-response recovery).
 */

import type { GameStateView, SubmissionKind } from '../api/gameStateClient'

/**
 * A response without a revision cannot be confirmed current (the owner
 * "has not computed it" yet), so it may only replace an *empty* view — it
 * must never overwrite an already-reconciled one. A response with a lower
 * or equal revision than what is already shown is a stale/duplicate
 * delivery and is always rejected to avoid regressing phase, accepted
 * decisions or entitled knowledge.
 */
export function shouldApplyGameState(current: GameStateView | null, next: GameStateView): boolean {
  if (next.revision === null) {
    return current === null
  }
  if (current === null || current.revision === null) {
    return true
  }
  return next.revision > current.revision
}

export interface BackoffOptions {
  readonly baseDelayMs: number
  readonly maxDelayMs: number
}

/** Doubles the poll delay on failure, up to a cap; resets to the base delay on success. */
export function nextPollDelayMs(currentDelayMs: number, outcome: 'success' | 'failure', options: BackoffOptions): number {
  if (outcome === 'success') {
    return options.baseDelayMs
  }
  return Math.min(Math.max(currentDelayMs, options.baseDelayMs) * 2, options.maxDelayMs)
}

export interface SubmissionQuery {
  readonly eraNumber: number
  readonly kind: SubmissionKind
  /** Required only for ACTION submissions, which are scoped to a round. */
  readonly roundNumber?: number | null
}

/**
 * Recovers the caller's own accepted decision before a duplicate retry
 * after a lost command response. Never inspects another player's choice —
 * the server already scopes `mySubmissions` to the caller alone.
 */
export function hasAcceptedSubmission(state: GameStateView | null, query: SubmissionQuery): boolean {
  if (!state) {
    return false
  }
  return state.mySubmissions.some((submission) => {
    if (submission.kind !== query.kind || submission.eraNumber !== query.eraNumber) {
      return false
    }
    if (query.roundNumber === undefined) {
      return true
    }
    return submission.roundNumber === query.roundNumber
  })
}
