import { useMemo } from 'react'
import type { GameStateSession } from '../game/useGameState'
import { selectRoundSummaryView, type RoundSummaryView } from './roundSummaryView'

export interface UseRoundSummaryOptions {
  readonly gameState: GameStateSession
}

/**
 * Derives the public typed round summary from the shared, revision-gated
 * game-state poll. The summary is identical for every participant and
 * carries only category and family, so reusing the same poll guarantees a
 * stale response can never overwrite an already reconciled view.
 */
export function useRoundSummary(options: UseRoundSummaryOptions): RoundSummaryView {
  const { gameState } = options
  return useMemo(() => selectRoundSummaryView(gameState.state), [gameState.state])
}
