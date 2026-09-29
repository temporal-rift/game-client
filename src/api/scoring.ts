/**
 * Participant-scoped scores against the pinned `scoring-api` contract
 * (`GET /api/v1/games/{gameId}/scores` and `.../scores/history`).
 *
 * Factions stay hidden until the final reveal and score-change reasons are
 * entitled per viewer: before the reveal an opponent entry omits any
 * faction-identifying reason, while after the reveal permitted detailed
 * reasons may be present for every participant. The client never infers a
 * missing faction or reason and never derives winners from score order.
 */

import { apiClientsFor, apiErrorMessage, callApi, type AuthenticatedFetchFn } from './client'
import { getScores as getScoresCall, getScoresHistory as getScoresHistoryCall } from './generated/scoring'
import type { ScoresHistoryResponse, ScoresResponse } from './generated/scoring'

export type { ScoresHistoryResponse, ScoresResponse } from './generated/scoring'

/** Reads the participant-scoped current scores; factions are absent until the final reveal. */
export async function getScores(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
  init: { readonly signal?: AbortSignal } = {},
): Promise<ScoresResponse> {
  if (!gameId.trim()) {
    throw new Error('A game reference is needed to read its scores.')
  }
  const client = apiClientsFor(fetchFn, apiBaseUrl).scoring
  return callApi('read the scores', () => getScoresCall({ client, path: { gameId }, signal: init.signal }))
}

/**
 * Reads the participant-scoped scoring history by era. Each viewer receives
 * only their entitled reasons; opponent reasons withheld to protect hidden
 * information arrive absent and must be shown as withheld, never guessed.
 */
export async function getScoresHistory(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
  init: { readonly signal?: AbortSignal } = {},
): Promise<ScoresHistoryResponse> {
  if (!gameId.trim()) {
    throw new Error('A game reference is needed to read its score history.')
  }
  const client = apiClientsFor(fetchFn, apiBaseUrl).scoring
  return callApi('read the score history', () => getScoresHistoryCall({ client, path: { gameId }, signal: init.signal }))
}

/** Maps stable problem codes to player-safe messages; unknown codes keep the server detail. */
export function scoresErrorMessage(error: unknown): string {
  return apiErrorMessage(error, (problem) =>
    problem.code === '404-01' ? 'Game not found, or you are not a participant of it.' : null,
  )
}
