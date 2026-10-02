/**
 * Participant-scoped game state against the pinned `projection-api`
 * contract (`GET /api/v1/games/{gameId}/state`), validated whole at the
 * client boundary. Feature modules read their own slice of the typed state.
 *
 * `revision`/`lastUpdatedAt` are freshness markers for one game's projection
 * only; they never promise global or cross-topic event order.
 */

import { apiClientsFor, apiErrorMessage, callApi, type AuthenticatedFetchFn } from './client'
import { getGameState as getGameStateCall, type PlayerGameStateResponse } from './generated/projection'
import { zPhase } from './generated/projection/zod.gen'

export type { AuthenticatedFetchFn } from './client'
export type {
  ActionFamily,
  ActionSummary,
  ActiveEvent,
  ActivistDeclarationMode,
  ExposeFact,
  EligibleResolutionCard,
  GameResult,
  MySubmission,
  OpenParadox,
  ParadoxType,
  Phase,
  SubmissionChoice,
  SubmissionWindow,
  PlayerInGame,
  PublicBandEvent,
  PublicBandOutcome,
  PublicDeclaration,
  RevealedIntel,
  SpecialBudget,
  SubmissionProgress,
} from './generated/projection'

export const PHASES = zPhase.options

/** Action rounds per era, as many as the contract defines action-round phases. */
export const ACTION_ROUNDS_PER_ERA = PHASES.filter((phase) => phase.startsWith('ACTION_ROUND_')).length

/** One participant's authoritative game state, exactly as the contract defines it. */
export type GameStateView = PlayerGameStateResponse

/**
 * Recovers the caller's participant-scoped game state. The reload-safe,
 * pollable read: never mutates server state, so it is always safe to retry.
 */
export async function getGameState(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
  init: { readonly signal?: AbortSignal } = {},
): Promise<GameStateView> {
  if (!gameId.trim()) {
    throw new Error('A game reference is needed to read its state.')
  }
  const client = apiClientsFor(fetchFn, apiBaseUrl).projection
  return callApi('read the game state', () => getGameStateCall({ client, path: { gameId }, signal: init.signal }))
}

/** Maps stable problem codes to player-safe messages; unknown codes keep the server detail. */
export function gameStateErrorMessage(error: unknown): string {
  return apiErrorMessage(error, (problem) =>
    problem.code === '404-01' ? 'Game not found, or you are not a participant of it.' : null,
  )
}
