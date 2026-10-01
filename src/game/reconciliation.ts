/**
 * Pure reconciliation rules shared by every polling feature module: whether
 * a freshly fetched game state may replace what is currently shown, how
 * long to wait before the next poll, and whether the caller's own decision
 * for a coordinate was already accepted (lost-response recovery).
 */

import type { GameStateView, SubmissionWindow } from '../api/projection'

/**
 * A response without a revision cannot be confirmed current (the owner
 * "has not computed it" yet), so it may only replace an *empty* view — it
 * must never overwrite an already-reconciled one. A response with a lower
 * or equal revision than what is already shown is a stale/duplicate
 * delivery and is always rejected to avoid regressing phase, accepted
 * decisions or entitled knowledge.
 */
export function shouldApplyGameState(current: GameStateView | null, next: GameStateView): boolean {
  if (next.revision === undefined) {
    return current === null
  }
  if (current?.revision == null) {
    return true
  }
  return next.revision > current.revision
}

export interface BackoffOptions {
  readonly baseDelayMs: number
  readonly maxDelayMs: number
}

/**
 * The delay before the next poll: the base delay after a success, doubled
 * for every consecutive failure since, up to a cap.
 */
export function backoffDelayMs(consecutiveFailures: number, options: BackoffOptions): number {
  return Math.min(options.baseDelayMs * 2 ** Math.max(consecutiveFailures, 0), options.maxDelayMs)
}

export interface SubmissionQuery {
  readonly eraNumber: number
  readonly window: SubmissionWindow
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
  return (state.mySubmissions ?? []).some((submission) => {
    if (submission.window !== query.window || submission.eraNumber !== query.eraNumber) {
      return false
    }
    if (query.roundNumber === undefined) {
      return true
    }
    return submission.roundNumber === query.roundNumber
  })
}
