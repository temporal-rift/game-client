import { useCallback, useMemo } from 'react'
import type { AuthenticatedFetchFn } from '../api/gameStateClient'
import { useGameState } from '../game/useGameState'
import { selectKnowledgeView, type KnowledgeView } from './knowledgeView'

export interface UseKnowledgeOptions {
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
  readonly gameId: string | null
  /** Identifies the current viewer; entitled knowledge clears whenever this or gameId changes. */
  readonly perspectiveKey: string | null
  readonly pollIntervalMs?: number
}

export interface KnowledgeSession {
  readonly view: KnowledgeView
  readonly status: 'idle' | 'loading' | 'ready' | 'stalled' | 'failed'
  readonly message: string | null
  readonly isRefreshing: boolean
  readonly refresh: () => Promise<void>
}

/**
 * Derives public bands, own earned knowledge and already-broadcast
 * declaration/Expose facts from the shared, revision-gated game-state poll.
 * Reusing that same poll (rather than an independently cached read) is what
 * guarantees a stale or jam-affected response can never overwrite already
 * reconciled entitled knowledge — `shouldApplyGameState` rejects it before
 * this view is ever rebuilt from it.
 */
export function useKnowledge(options: UseKnowledgeOptions): KnowledgeSession {
  const { apiBaseUrl, fetchFn, gameId, perspectiveKey, pollIntervalMs } = options
  const gameState = useGameState({
    apiBaseUrl,
    fetchFn,
    gameId,
    perspectiveKey,
    ...(pollIntervalMs === undefined ? {} : { pollIntervalMs }),
  })

  const view = useMemo(() => selectKnowledgeView(gameState.state), [gameState.state])

  const refresh = useCallback(async () => {
    await gameState.refresh()
  }, [gameState])

  return useMemo(() => {
    const detail = gameState.status
    const message = detail.kind === 'stalled' || detail.kind === 'failed' ? detail.message : null
    return { view, status: detail.kind, message, isRefreshing: detail.kind === 'loading', refresh }
  }, [view, gameState.status, refresh])
}
