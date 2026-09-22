import { vi } from 'vitest'
import type { GameStateView } from '../api/gameStateClient'
import type { SubmissionQuery } from './reconciliation'
import { hasAcceptedSubmission as checkAcceptedSubmission } from './reconciliation'
import type { GameStateSession, GameStateStatus } from './useGameState'

/**
 * Builds a directly-controlled `GameStateSession` double for feature-hook
 * tests, so they exercise the hook's own derived view/draft/submit logic
 * without driving `useGameState`'s internal polling — that behavior has its
 * own dedicated coverage in `useGameState.test.ts`.
 */
export function createGameStateSession(overrides: {
  readonly state?: GameStateView | null
  readonly status?: GameStateStatus
  readonly refresh?: () => Promise<GameStateView | null>
} = {}): GameStateSession {
  const state = overrides.state ?? null
  const status = overrides.status ?? { kind: state ? 'ready' : 'idle' }
  const refresh = vi.fn(overrides.refresh ?? (async () => state))
  return {
    state,
    status,
    refresh,
    hasAcceptedSubmission: (query: SubmissionQuery) => checkAcceptedSubmission(state, query),
  }
}
