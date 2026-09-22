import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AuthenticatedFetchFn } from '../api/gameStateClient'
import { ScoresApiError, getScores, getScoresHistory, scoresErrorMessage } from '../api/scoresClient'
import type { ScoresHistoryView, ScoresView } from '../api/scoresClient'
import type { GameStateSession } from '../game/useGameState'
import { selectResultsView, type ResultsView } from './resultsView'

export interface UseResultsOptions {
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
  readonly gameState: GameStateSession
  readonly ownPlayerId: string | null
  readonly perspectiveKey: string | null
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
 * stays authoritative through the shared polling layer (freshness by
 * revision, cancellation on perspective change); scores and score history
 * are fetched only once the terminal phase carries a complete published
 * result, and are re-fetched on explicit refresh so a reload shows the
 * same winner set and totals instead of a locally cached guess.
 */
export function useResults(options: UseResultsOptions): ResultsSession {
  const { apiBaseUrl, fetchFn, gameState, ownPlayerId, perspectiveKey } = options
  const [scores, setScores] = useState<{ data: ScoresView; perspectiveKey: string | null } | null>(null)
  const [history, setHistory] = useState<{ data: ScoresHistoryView; perspectiveKey: string | null } | null>(null)
  const [scoresError, setScoresError] = useState<{
    message: string
    code: string | null
    gameId: string
    perspectiveKey: string | null
  } | null>(null)
  const [activeRefresh, setActiveRefresh] = useState<{
    seq: number
    gameId: string
    perspectiveKey: string | null
  } | null>(null)
  const refreshSeqRef = useRef(0)

  const fetchRef = useRef(fetchFn)
  useEffect(() => {
    fetchRef.current = fetchFn
  }, [fetchFn])

  const perspectiveRef = useRef(perspectiveKey)
  useEffect(() => {
    perspectiveRef.current = perspectiveKey
  }, [perspectiveKey])

  const state = gameState.state
  const effectiveGameId = state?.gameId ?? null
  const gameIdRef = useRef<string | null>(null)
  useEffect(() => {
    gameIdRef.current = effectiveGameId
  }, [effectiveGameId])

  const hasCompleteResult = state?.phase === 'GAME_ENDED' && state.result !== null

  const visibleScores =
    scores && scores.data.gameId === effectiveGameId && scores.perspectiveKey === perspectiveKey ? scores.data : null
  const visibleHistory =
    history && history.data.gameId === effectiveGameId && history.perspectiveKey === perspectiveKey
      ? history.data
      : null
  const visibleScoresError =
    scoresError && scoresError.gameId === effectiveGameId && scoresError.perspectiveKey === perspectiveKey
      ? scoresError
      : null

  useEffect(() => {
    if (!hasCompleteResult || !effectiveGameId) {
      return
    }
    const requestGameId = effectiveGameId
    const requestPerspective = perspectiveKey
    let cancelled = false
    const controller = new AbortController()
    void (async () => {
      try {
        const [nextScores, nextHistory] = await Promise.all([
          getScores(fetchRef.current, apiBaseUrl, requestGameId, { signal: controller.signal }),
          getScoresHistory(fetchRef.current, apiBaseUrl, requestGameId, { signal: controller.signal }),
        ])
        if (cancelled || perspectiveRef.current !== requestPerspective || gameIdRef.current !== requestGameId) {
          return
        }
        setScores({ data: nextScores, perspectiveKey: requestPerspective })
        setHistory({ data: nextHistory, perspectiveKey: requestPerspective })
        setScoresError(null)
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) {
          return
        }
        if (perspectiveRef.current !== requestPerspective || gameIdRef.current !== requestGameId) {
          return
        }
        const code = error instanceof ScoresApiError ? error.code : null
        setScoresError({ message: scoresErrorMessage(error), code, gameId: requestGameId, perspectiveKey: requestPerspective })
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [hasCompleteResult, effectiveGameId, apiBaseUrl, perspectiveKey])

  const refresh = useCallback(async () => {
    const requestPerspective = perspectiveRef.current
    const next = await gameState.refresh()
    const requestGameId = next?.gameId ?? null
    const terminal = next?.phase === 'GAME_ENDED' && next.result !== null
    if (!terminal || !requestGameId) {
      return
    }
    refreshSeqRef.current += 1
    const seq = refreshSeqRef.current
    setActiveRefresh({ seq, gameId: requestGameId, perspectiveKey: requestPerspective })
    try {
      const [nextScores, nextHistory] = await Promise.all([
        getScores(fetchRef.current, apiBaseUrl, requestGameId),
        getScoresHistory(fetchRef.current, apiBaseUrl, requestGameId),
      ])
      if (perspectiveRef.current !== requestPerspective || gameIdRef.current !== requestGameId) {
        return
      }
      setScores({ data: nextScores, perspectiveKey: requestPerspective })
      setHistory({ data: nextHistory, perspectiveKey: requestPerspective })
      setScoresError(null)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      if (perspectiveRef.current !== requestPerspective || gameIdRef.current !== requestGameId) {
        return
      }
      const code = error instanceof ScoresApiError ? error.code : null
      setScoresError({ message: scoresErrorMessage(error), code, gameId: requestGameId, perspectiveKey: requestPerspective })
    } finally {
      setActiveRefresh((current) => (current?.seq === seq ? null : current))
    }
  }, [gameState, apiBaseUrl])

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

  const isRefreshingForContext =
    activeRefresh !== null &&
    activeRefresh.gameId === effectiveGameId &&
    activeRefresh.perspectiveKey === perspectiveKey

  return useMemo(
    () => ({
      view,
      status: combined.status,
      message: combined.message,
      code: combined.code,
      isRefreshing: gameState.status.kind === 'loading' || isRefreshingForContext,
      refresh,
    }),
    [view, combined, gameState.status.kind, isRefreshingForContext, refresh],
  )
}
