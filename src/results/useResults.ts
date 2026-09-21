import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AuthenticatedFetchFn } from '../api/gameStateClient'
import { ScoresApiError, getScores, getScoresHistory, scoresErrorMessage } from '../api/scoresClient'
import type { ScoresHistoryView, ScoresView } from '../api/scoresClient'
import { useGameState } from '../game/useGameState'
import { selectResultsView, type ResultsView } from './resultsView'

export interface UseResultsOptions {
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
  readonly gameId: string | null
  readonly ownPlayerId: string | null
  readonly perspectiveKey: string | null
  readonly pollIntervalMs?: number
}

export interface ResultsSession {
  readonly view: ResultsView
  readonly status: 'idle' | 'loading' | 'ready' | 'stalled' | 'failed'
  readonly message: string | null
  readonly code: string | null
  readonly isRefreshing: boolean
  readonly refresh: () => Promise<void>
}

const RESULTS_GAME_STORAGE_KEY = 'temporal-rift.private.resultsGameId'

function storageKeyFor(perspectiveKey: string | null): string {
  return perspectiveKey ? `${RESULTS_GAME_STORAGE_KEY}.${perspectiveKey}` : RESULTS_GAME_STORAGE_KEY
}

function readStoredGameId(perspectiveKey: string | null): string | null {
  try {
    const value = sessionStorage.getItem(storageKeyFor(perspectiveKey))
    return value && value.length > 0 ? value : null
  } catch {
    return null
  }
}

function writeStoredGameId(gameId: string, perspectiveKey: string | null): void {
  try {
    sessionStorage.setItem(storageKeyFor(perspectiveKey), gameId)
  } catch {
    // Reload recovery is best-effort; authoritative state stays server-side.
  }
}

/**
 * Owns the reload-safe terminal results read for one participant. Game state
 * stays authoritative through the shared polling layer (freshness by
 * revision, cancellation on perspective change); scores and score history
 * are fetched only once the terminal phase carries a complete published
 * result, and are re-fetched on explicit refresh so a reload shows the
 * same winner set and totals instead of a locally cached guess.
 */
export function useResults(options: UseResultsOptions): ResultsSession {
  const { apiBaseUrl, fetchFn, gameId, ownPlayerId, perspectiveKey, pollIntervalMs } = options
  const [scores, setScores] = useState<ScoresView | null>(null)
  const [history, setHistory] = useState<ScoresHistoryView | null>(null)
  const [scoresError, setScoresError] = useState<{ message: string; code: string | null; gameId: string } | null>(null)
  const [isRefreshingScores, setIsRefreshingScores] = useState(false)

  const fetchRef = useRef(fetchFn)
  useEffect(() => {
    fetchRef.current = fetchFn
  }, [fetchFn])

  const effectiveGameId = useMemo(() => {
    if (gameId) {
      return gameId
    }
    return readStoredGameId(perspectiveKey)
  }, [gameId, perspectiveKey])

  useEffect(() => {
    if (gameId) {
      writeStoredGameId(gameId, perspectiveKey)
    }
  }, [gameId, perspectiveKey])

  const gameState = useGameState({
    apiBaseUrl,
    fetchFn,
    gameId: effectiveGameId,
    perspectiveKey,
    ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
  })

  const state = gameState.state
  const hasCompleteResult = state?.phase === 'GAME_ENDED' && state.result !== null

  const visibleScores = scores?.gameId === effectiveGameId ? scores : null
  const visibleHistory = history?.gameId === effectiveGameId ? history : null
  const visibleScoresError = scoresError?.gameId === effectiveGameId ? scoresError : null

  useEffect(() => {
    if (!hasCompleteResult || !effectiveGameId) {
      return
    }
    let cancelled = false
    const controller = new AbortController()
    void (async () => {
      try {
        const [nextScores, nextHistory] = await Promise.all([
          getScores(fetchRef.current, apiBaseUrl, effectiveGameId, { signal: controller.signal }),
          getScoresHistory(fetchRef.current, apiBaseUrl, effectiveGameId, { signal: controller.signal }),
        ])
        if (cancelled) {
          return
        }
        setScores(nextScores)
        setHistory(nextHistory)
        setScoresError(null)
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) {
          return
        }
        const code = error instanceof ScoresApiError ? error.code : null
        const failedGameId = effectiveGameId
        if (failedGameId) {
          setScoresError({ message: scoresErrorMessage(error), code, gameId: failedGameId })
        }
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [hasCompleteResult, effectiveGameId, apiBaseUrl, perspectiveKey])

  const refresh = useCallback(async () => {
    const next = await gameState.refresh()
    const terminal = next?.phase === 'GAME_ENDED' && next.result !== null
    if (!terminal || !effectiveGameId) {
      return
    }
    setIsRefreshingScores(true)
    try {
      const [nextScores, nextHistory] = await Promise.all([
        getScores(fetchRef.current, apiBaseUrl, effectiveGameId),
        getScoresHistory(fetchRef.current, apiBaseUrl, effectiveGameId),
      ])
      setScores(nextScores)
      setHistory(nextHistory)
      setScoresError(null)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      const code = error instanceof ScoresApiError ? error.code : null
      setScoresError({ message: scoresErrorMessage(error), code, gameId: effectiveGameId })
    } finally {
      setIsRefreshingScores(false)
    }
  }, [gameState, effectiveGameId, apiBaseUrl])

  const view = useMemo(
    () => selectResultsView(state, visibleScores, visibleHistory, ownPlayerId),
    [state, visibleScores, visibleHistory, ownPlayerId],
  )

  const combined = useMemo((): Pick<ResultsSession, 'status' | 'message' | 'code'> => {
    const detail = gameState.status
    if (detail.kind === 'stalled' || detail.kind === 'failed') {
      return { status: detail.kind, message: detail.message, code: detail.code }
    }
    if (visibleScoresError && view.kind === 'complete') {
      return { status: 'stalled', message: visibleScoresError.message, code: visibleScoresError.code }
    }
    return { status: detail.kind, message: null, code: null }
  }, [gameState.status, visibleScoresError, view.kind])

  return useMemo(
    () => ({
      view,
      status: combined.status,
      message: combined.message,
      code: combined.code,
      isRefreshing: gameState.status.kind === 'loading' || isRefreshingScores,
      refresh,
    }),
    [view, combined, gameState.status.kind, isRefreshingScores, refresh],
  )
}
