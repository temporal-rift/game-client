import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AuthenticatedFetchFn, GameStateView } from '../api/gameStateClient'
import { GameStateApiError, gameStateErrorMessage, getGameState } from '../api/gameStateClient'
import type { SubmissionQuery } from './reconciliation'
import { hasAcceptedSubmission as checkAcceptedSubmission, nextPollDelayMs, shouldApplyGameState } from './reconciliation'

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
  /** Identifies the current viewer (e.g. player subject); state clears whenever this or gameId changes. */
  readonly perspectiveKey: string | null
  readonly pollIntervalMs?: number
  readonly maxPollIntervalMs?: number
}

export interface GameStateSession {
  readonly status: GameStateStatus
  readonly state: GameStateView | null
  /** Forces an immediate authoritative read, bypassing the poll timer. */
  readonly refresh: () => Promise<GameStateView | null>
  readonly hasAcceptedSubmission: (query: SubmissionQuery) => boolean
}

const DEFAULT_POLL_INTERVAL_MS = 4000
const DEFAULT_MAX_POLL_INTERVAL_MS = 32000

function perspectiveId(gameId: string | null, perspectiveKey: string | null): string | null {
  return gameId && perspectiveKey ? `${perspectiveKey}::${gameId}` : null
}

/** True while the tab is backgrounded or the browser reports no connectivity. */
function isPollingPaused(): boolean {
  if (typeof document !== 'undefined' && document.hidden) {
    return true
  }
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

type PollErrorOutcome =
  | { readonly ignore: true }
  | { readonly ignore: false; readonly message: string; readonly code: string | null }

/** An aborted request is intentional cancellation, never a reported failure. */
function classifyPollError(error: unknown): PollErrorOutcome {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { ignore: true }
  }
  return { ignore: false, message: gameStateErrorMessage(error), code: error instanceof GameStateApiError ? error.code : null }
}

/**
 * Owns authenticated polling of one participant's game state: freshness
 * reconciliation by revision, controlled backoff across network/tab
 * interruptions, and cancellation of in-flight reads that no longer belong
 * to the current identity/game perspective. Feature modules (hand, action,
 * paradox, results) read `state`/`state.raw` for their own slice and call
 * `hasAcceptedSubmission` to recover own-acceptance before a duplicate
 * retry after a lost command response.
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

  const [status, setStatus] = useState<GameStateStatus>({ kind: gameId ? 'loading' : 'idle' })
  const [state, setState] = useState<GameStateView | null>(null)

  const fetchRef = useRef(fetchFn)
  const stateRef = useRef<GameStateView | null>(null)
  const perspectiveRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<number | null>(null)
  const delayRef = useRef(pollIntervalMs)

  useEffect(() => {
    fetchRef.current = fetchFn
  }, [fetchFn])
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const advanceDelay = useCallback(
    (outcome: 'success' | 'failure') => {
      delayRef.current = nextPollDelayMs(delayRef.current, outcome, {
        baseDelayMs: pollIntervalMs,
        maxDelayMs: maxPollIntervalMs,
      })
    },
    [maxPollIntervalMs, pollIntervalMs],
  )

  const runPoll = useCallback(
    async (activePerspective: string, activeGameId: string): Promise<GameStateView | null> => {
      if (isPollingPaused()) {
        return null
      }
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const next = await getGameState(fetchRef.current, apiBaseUrl, activeGameId, { signal: controller.signal })
        if (perspectiveRef.current !== activePerspective) {
          return null
        }
        advanceDelay('success')
        if (!shouldApplyGameState(stateRef.current, next)) {
          setStatus({ kind: 'ready' })
          return stateRef.current
        }
        stateRef.current = next
        setState(next)
        setStatus({ kind: 'ready' })
        return next
      } catch (error) {
        const outcome = classifyPollError(error)
        if (outcome.ignore || perspectiveRef.current !== activePerspective) {
          return null
        }
        advanceDelay('failure')
        setStatus(stateRef.current ? { kind: 'stalled', ...outcome } : { kind: 'failed', ...outcome })
        return null
      }
    },
    [apiBaseUrl, advanceDelay],
  )

  const scheduleNextRef = useRef<(activePerspective: string, activeGameId: string) => void>(() => {})

  const scheduleNext = useCallback(
    (activePerspective: string, activeGameId: string) => {
      clearTimer()
      timerRef.current = window.setTimeout(() => {
        void runPoll(activePerspective, activeGameId).finally(() => {
          if (perspectiveRef.current === activePerspective) {
            scheduleNextRef.current(activePerspective, activeGameId)
          }
        })
      }, delayRef.current)
    },
    [clearTimer, runPoll],
  )
  useEffect(() => {
    scheduleNextRef.current = scheduleNext
  }, [scheduleNext])

  // Perspective/game changes: abort in-flight reads and clear state before
  // anything from the previous perspective can populate the new one.
  useEffect(() => {
    const current = perspectiveId(gameId, perspectiveKey)
    perspectiveRef.current = current
    abortRef.current?.abort()
    clearTimer()
    stateRef.current = null
    setState(null)
    delayRef.current = pollIntervalMs

    if (!current || !gameId) {
      setStatus({ kind: 'idle' })
      return
    }

    setStatus({ kind: 'loading' })
    void runPoll(current, gameId).finally(() => {
      if (perspectiveRef.current === current) {
        scheduleNext(current, gameId)
      }
    })

    return () => {
      abortRef.current?.abort()
      clearTimer()
      // Invalidates any in-flight poll's perspective check. On a deps change
      // (not unmount) the effect body above runs again synchronously right
      // after this and immediately reassigns perspectiveRef.current, so this
      // only actually matters — and only takes effect — on real unmount,
      // where it stops a pending `.finally` from rescheduling a zombie loop.
      perspectiveRef.current = null
    }
  }, [gameId, perspectiveKey, runPoll, scheduleNext, clearTimer, pollIntervalMs])

  // Resume promptly (with reset backoff) when the tab regains visibility or
  // network connectivity returns, instead of waiting out the current backoff.
  useEffect(() => {
    function resume(): void {
      const current = perspectiveRef.current
      if (!current || !gameId) {
        return
      }
      delayRef.current = pollIntervalMs
      clearTimer()
      void runPoll(current, gameId).finally(() => {
        if (perspectiveRef.current === current) {
          scheduleNext(current, gameId)
        }
      })
    }

    function onVisibilityChange(): void {
      if (!document.hidden) {
        resume()
      }
    }

    window.addEventListener('online', resume)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('online', resume)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [gameId, pollIntervalMs, clearTimer, runPoll, scheduleNext])

  const refresh = useCallback(async (): Promise<GameStateView | null> => {
    const current = perspectiveRef.current
    if (!current || !gameId) {
      return null
    }
    delayRef.current = pollIntervalMs
    clearTimer()
    const result = await runPoll(current, gameId)
    if (perspectiveRef.current === current) {
      scheduleNext(current, gameId)
    }
    return result
  }, [gameId, pollIntervalMs, clearTimer, runPoll, scheduleNext])

  const hasAcceptedSubmission = useCallback(
    (query: SubmissionQuery) => checkAcceptedSubmission(stateRef.current, query),
    [],
  )

  return useMemo(
    () => ({ status, state, refresh, hasAcceptedSubmission }),
    [status, state, refresh, hasAcceptedSubmission],
  )
}
