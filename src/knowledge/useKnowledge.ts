import { useCallback, useMemo } from 'react'
import type { GameStateSession } from '../game/useGameState'
import { selectKnowledgeView, type KnowledgeView } from './knowledgeView'

export interface UseKnowledgeOptions {
  readonly gameState: GameStateSession
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
  const { gameState } = options

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
