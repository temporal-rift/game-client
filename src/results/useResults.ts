import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiProblemError } from '../api/client'
import type { AuthenticatedFetchFn } from '../api/projection'
import { scoresHistoryQuery, scoresQuery } from '../api/queries'
import { scoresErrorMessage } from '../api/scoring'
import type { GameStateSession } from '../game/useGameState'
import { selectResultsView, type ResultsView } from './resultsView'

export interface UseResultsOptions {
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
  readonly gameState: GameStateSession
  readonly ownPlayerId: string | null
  readonly perspectiveKey: string | null
}

/** The viewer and game an explicit refresh was started for. */
interface RefreshContext {
  readonly perspectiveKey: string | null
  readonly gameId: string | null
}

export interface ResultsSession {
  readonly view: ResultsView
  readonly status: 'idle' | 'loading' | 'ready' | 'stalled' | 'failed'
  readonly message: string | null
  readonly code: string | null
  readonly isRefreshing: boolean
  readonly refresh: () => Promise<void>
}

/**
 * Owns the reload-safe terminal results read for one participant. Game state
 * stays authoritative through the shared polling layer; scores and score
 * history are read only once the terminal phase carries a complete published
 * result, cached per viewer and game, and re-read on explicit refresh so a
 * reload shows the same winner set and totals instead of a local guess.
 */
export function useResults(options: UseResultsOptions): ResultsSession {
  const { apiBaseUrl, fetchFn, gameState, ownPlayerId, perspectiveKey } = options
  const queryClient = useQueryClient()
  const state = gameState.state
  const gameId = state?.gameId ?? null
  const hasCompleteResult = state?.phase === 'GAME_ENDED' && state.result !== undefined
  const enabled = hasCompleteResult && gameId !== null && perspectiveKey !== null

  const scope = useMemo(() => ({ perspective: perspectiveKey ?? '', apiBaseUrl, fetchFn }), [perspectiveKey, apiBaseUrl, fetchFn])
  const scores = useQuery({ ...scoresQuery(scope, gameId ?? ''), enabled })
  const history = useQuery({ ...scoresHistoryQuery(scope, gameId ?? ''), enabled })

  const visibleScores = enabled ? (scores.data ?? null) : null
  const visibleHistory = enabled ? (history.data ?? null) : null
  const scoresError = enabled ? (scores.error ?? history.error) : null

  // An explicit refresh belongs to the viewer and game it started for: another context never
  // shows it as in progress.
  const {
    mutateAsync: runRefresh,
    isPending: refreshPending,
    variables: refreshContext,
  } = useMutation<void, Error, RefreshContext>({
    mutationFn: async () => {
      const next = await gameState.refresh()
      if (next?.phase !== 'GAME_ENDED' || next.result === undefined || perspectiveKey === null) {
        return
      }
      // Re-reads the terminal scores for the game the fresh state names; failures land on the queries.
      await Promise.all([
        queryClient.refetchQueries({ queryKey: scoresQuery(scope, next.gameId).queryKey }),
        queryClient.refetchQueries({ queryKey: scoresHistoryQuery(scope, next.gameId).queryKey }),
      ])
    },
  })

  const refresh = useCallback(async () => {
    await runRefresh({ perspectiveKey, gameId }).catch(() => undefined)
  }, [runRefresh, perspectiveKey, gameId])

  const view = useMemo(
    () => selectResultsView(state, visibleScores, visibleHistory, ownPlayerId),
    [state, visibleScores, visibleHistory, ownPlayerId],
  )

  const combined = useMemo((): Pick<ResultsSession, 'status' | 'message' | 'code'> => {
    const detail = gameState.status
    if (detail.kind === 'stalled' || detail.kind === 'failed') {
      return { status: detail.kind, message: detail.message, code: detail.code }
    }
    if (scoresError && view.kind === 'complete') {
      const code = scoresError instanceof ApiProblemError ? scoresError.code : null
      return { status: 'stalled', message: scoresErrorMessage(scoresError), code }
    }
    return { status: detail.kind, message: null, code: null }
  }, [gameState.status, scoresError, view.kind])

  const isRefreshing =
    gameState.status.kind === 'loading' ||
    (refreshPending && refreshContext?.perspectiveKey === perspectiveKey && refreshContext.gameId === gameId)

  return useMemo(
    () => ({ view, status: combined.status, message: combined.message, code: combined.code, isRefreshing, refresh }),
    [view, combined, isRefreshing, refresh],
  )
}
