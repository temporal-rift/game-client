/**
 * Query keys and options for server state. Every key starts with the
 * viewer's perspective (their identity subject), so one player's cached
 * private state can never answer another player's query.
 */

import { queryOptions } from '@tanstack/react-query'
import type { AuthenticatedFetchFn } from './client'
import { getGameState, type GameStateView } from './projection'
import { getScores, getScoresHistory } from './scoring'
import { getLobby } from './session'
import { shouldApplyGameState } from '../game/reconciliation'

export interface QueryScope {
  /** The viewer's identity subject. */
  readonly perspective: string
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
}

export const queryKeys = {
  all: ['temporal-rift'] as const,
  perspective: (perspective: string) => [...queryKeys.all, perspective] as const,
  lobby: (perspective: string, lobbyId: string) => [...queryKeys.perspective(perspective), 'lobby', lobbyId] as const,
  gameState: (perspective: string, gameId: string) => [...queryKeys.perspective(perspective), 'game-state', gameId] as const,
  scores: (perspective: string, gameId: string) => [...queryKeys.perspective(perspective), 'scores', gameId] as const,
  scoresHistory: (perspective: string, gameId: string) => [...queryKeys.perspective(perspective), 'scores-history', gameId] as const,
}

export function lobbyQuery(scope: QueryScope, lobbyId: string) {
  return queryOptions({
    queryKey: queryKeys.lobby(scope.perspective, lobbyId),
    queryFn: ({ signal }) => getLobby(scope.fetchFn, scope.apiBaseUrl, lobbyId, { signal }),
  })
}

/**
 * Game state reconciles by revision as it lands: a response that is not
 * newer than the cached view keeps the cached view, so a stale or duplicate
 * delivery can never regress phase, accepted decisions or entitled knowledge.
 */
export function gameStateQuery(scope: QueryScope, gameId: string) {
  const queryKey = queryKeys.gameState(scope.perspective, gameId)
  return queryOptions({
    queryKey,
    queryFn: async ({ signal, client }) => {
      const next = await getGameState(scope.fetchFn, scope.apiBaseUrl, gameId, { signal })
      const current = client.getQueryData<GameStateView>(queryKey) ?? null
      return current && !shouldApplyGameState(current, next) ? current : next
    },
  })
}

export function scoresQuery(scope: QueryScope, gameId: string) {
  return queryOptions({
    queryKey: queryKeys.scores(scope.perspective, gameId),
    queryFn: ({ signal }) => getScores(scope.fetchFn, scope.apiBaseUrl, gameId, { signal }),
  })
}

export function scoresHistoryQuery(scope: QueryScope, gameId: string) {
  return queryOptions({
    queryKey: queryKeys.scoresHistory(scope.perspective, gameId),
    queryFn: ({ signal }) => getScoresHistory(scope.fetchFn, scope.apiBaseUrl, gameId, { signal }),
  })
}
