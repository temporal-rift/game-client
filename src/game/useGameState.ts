import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiProblemError } from '../api/client'
import { gameStateErrorMessage, type AuthenticatedFetchFn, type GameStateView } from '../api/projection'
import { gameStateQuery } from '../api/queries'
import { backoffDelayMs, hasAcceptedSubmission as checkAcceptedSubmission, type SubmissionQuery } from './reconciliation'

export type { SubmissionQuery } from './reconciliation'

export type GameStateStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready' }
  // Last known state is retained and shown while a poll is currently failing.
  | { readonly kind: 'stalled'; readonly message: string; readonly code: string | null }
  // No usable state has ever been reconciled for this perspective.
  | { readonly kind: 'failed'; readonly message: string; readonly code: string | null }

export interface UseGameStateOptions {
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
  readonly gameId: string | null
  /** Identifies the current viewer (e.g. player subject); state is scoped to it and to gameId. */
  readonly perspectiveKey: string | null
  readonly pollIntervalMs?: number
  readonly maxPollIntervalMs?: number
}

export interface GameStateSession {
  readonly status: GameStateStatus
  readonly state: GameStateView | null
  /** Forces an immediate authoritative read; resolves to null when that read fails. */
  readonly refresh: () => Promise<GameStateView | null>
  readonly hasAcceptedSubmission: (query: SubmissionQuery) => boolean
}

const DEFAULT_POLL_INTERVAL_MS = 4000
const DEFAULT_MAX_POLL_INTERVAL_MS = 32000

/**
 * Polls one participant's game state through the shared query cache:
 * freshness reconciliation by revision (in the query function), capped
 * backoff while polls fail, a pause while the tab is hidden or offline
 * with a prompt refresh on return, and state scoped to the viewer's
 * perspective and game. Feature modules (hand, action, paradox, results)
 * read `state` for their own slice and call `hasAcceptedSubmission` to
 * recover own-acceptance before a duplicate retry after a lost response.
 */
export function useGameState(options: UseGameStateOptions): GameStateSession {
  const {
    apiBaseUrl,
    fetchFn,
    gameId,
    perspectiveKey,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxPollIntervalMs = DEFAULT_MAX_POLL_INTERVAL_MS,
  } = options
  const enabled = Boolean(gameId && perspectiveKey)
  const queryClient = useQueryClient()
  const query = useMemo(
    () => gameStateQuery({ perspective: perspectiveKey ?? '', apiBaseUrl, fetchFn }, gameId ?? ''),
    [perspectiveKey, apiBaseUrl, fetchFn, gameId],
  )

  // Polls at the base interval; a failing poll retries with capped exponential backoff (paused
  // while the tab is hidden or offline) until one succeeds, which resets the interval.
  const { data, error, failureReason } = useQuery({
    ...query,
    enabled,
    refetchInterval: pollIntervalMs,
    retry: true,
    // `failureCount` counts the failures before this retry: the first retry waits twice the interval.
    retryDelay: (failureCount) => backoffDelayMs(failureCount + 1, { baseDelayMs: pollIntervalMs, maxDelayMs: maxPollIntervalMs }),
  })
  const state = enabled ? (data ?? null) : null
  const failure = error ?? failureReason

  const status = useMemo((): GameStateStatus => {
    if (!enabled) {
      return { kind: 'idle' }
    }
    if (failure) {
      const reason = { message: gameStateErrorMessage(failure), code: failure instanceof ApiProblemError ? failure.code : null }
      return data ? { kind: 'stalled', ...reason } : { kind: 'failed', ...reason }
    }
    return data ? { kind: 'ready' } : { kind: 'loading' }
  }, [enabled, data, failure])

  const refresh = useCallback(async (): Promise<GameStateView | null> => {
    if (!enabled) {
      return null
    }
    // One immediate read, outside any backoff in progress: callers reconcile against its answer.
    await queryClient.cancelQueries({ queryKey: query.queryKey })
    try {
      return await queryClient.query({ ...query, retry: false })
    } catch {
      return null
    }
  }, [enabled, queryClient, query])

  const hasAcceptedSubmission = useCallback((submission: SubmissionQuery) => checkAcceptedSubmission(state, submission), [state])

  return useMemo(() => ({ status, state, refresh, hasAcceptedSubmission }), [status, state, refresh, hasAcceptedSubmission])
}
