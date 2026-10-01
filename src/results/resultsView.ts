import type { GameResult, GameStateView, PlayerInGame } from '../api/projection'
import type { ScoresHistoryResponse, ScoresResponse } from '../api/scoring'

export type EndReason = GameResult['endReason']

export type WinType = NonNullable<GameResult['winners'][number]['winType']>

export function endReasonLabel(endReason: EndReason): string {
  switch (endReason) {
    case 'WIN_CONDITION_MET':
      return 'Victory'
    case 'TIMELINE_COLLAPSED':
      return 'Timeline collapsed'
    case 'TIMELINE_STABILIZED':
      return 'Timeline stabilized'
    case 'DECK_EXHAUSTED':
      return 'Card supply exhausted'
    case 'RESOLUTION_FAILED':
      return 'Final resolution could not complete'
    case 'ALL_PLAYERS_ABANDONED':
      return 'Every player left the game'
  }
}

/** How a winner of a WIN_CONDITION_MET ending won; null when the ending carries no win type. */
export function winTypeLabel(winType: WinType | null): string | null {
  switch (winType) {
    case null:
      return null
    case 'SCORE_THRESHOLD':
      return 'reached the score threshold'
    case 'FACTION_OBJECTIVE':
      return 'completed their faction objective'
    case 'LAST_PLAYER_STANDING':
      return 'last player standing — everyone else left'
  }
}

export function scoreReasonLabel(reason: string): string {
  if (reason === 'MIMIC_NEVER_TRACED') {
    return 'Mimic was never traced'
  }
  return reason
}

export interface ResultsPlayerEntry {
  readonly playerId: string
  readonly playerName: string | null
  readonly score: number
  readonly isWinner: boolean
  /** Permitted final faction; null while withheld before the recorded reveal boundary. */
  readonly faction: string | null
  /** How this winner won a WIN_CONDITION_MET ending; null otherwise. */
  readonly winType: WinType | null
}

export interface ResultsExplanationEntry {
  readonly playerId: string
  readonly playerName: string | null
  readonly eraNumber: number
  readonly pointsDelta: number
  /** Entitled reason; null means withheld to protect hidden information. */
  readonly reason: string | null
  readonly isOwn: boolean
}

export type ResultsView =
  | { readonly kind: 'active' }
  | { readonly kind: 'waiting'; readonly gameId: string; readonly eraNumber: number }
  | {
      readonly kind: 'complete'
      readonly gameId: string
      readonly endReason: EndReason
      readonly winners: readonly ResultsPlayerEntry[]
      readonly scores: readonly ResultsPlayerEntry[]
      readonly isRevealed: boolean
      readonly explanations: readonly ResultsExplanationEntry[]
    }

function playerNameFor(playerId: string, players: readonly PlayerInGame[], scores: ScoresResponse | null): string | null {
  const fromState = players.find((player) => player.playerId === playerId)?.playerName || null
  if (fromState) {
    return fromState
  }
  return scores?.scores.find((score) => score.playerId === playerId)?.playerName ?? null
}

function factionForPlayer(
  playerId: string,
  isRevealed: boolean,
  result: GameResult,
  scores: ScoresResponse | null,
  players: readonly PlayerInGame[],
): string | null {
  if (!isRevealed) {
    return null
  }
  const fromResult = result.winners.find((winner) => winner.playerId === playerId)?.faction || null
  if (fromResult) {
    return fromResult
  }
  const fromScores = scores?.scores.find((score) => score.playerId === playerId)?.faction || null
  if (fromScores) {
    return fromScores
  }
  return players.find((player) => player.playerId === playerId)?.faction || null
}

function orderedPlayersFrom(
  result: GameResult,
  players: readonly PlayerInGame[],
  scores: ScoresResponse | null,
  isRevealed: boolean,
): readonly ResultsPlayerEntry[] {
  const winTypeByWinner = new Map(result.winners.map((winner) => [winner.playerId, winner.winType] as const))
  const scoreByPlayer = new Map(result.finalScores.map((entry) => [entry.playerId, entry.score] as const))
  const playerIds = Array.from(
    new Set([
      ...result.finalScores.map((entry) => entry.playerId),
      ...result.winners.map((winner) => winner.playerId),
      ...players.map((player) => player.playerId),
    ]),
  )
  return playerIds.map((playerId) => ({
    playerId,
    playerName: playerNameFor(playerId, players, scores),
    score: scoreByPlayer.get(playerId) ?? players.find((player) => player.playerId === playerId)?.score ?? 0,
    isWinner: winTypeByWinner.has(playerId),
    faction: factionForPlayer(playerId, isRevealed, result, scores, players),
    winType: winTypeByWinner.get(playerId) ?? null,
  }))
}

function explanationsFrom(
  history: ScoresHistoryResponse | null,
  players: readonly PlayerInGame[],
  scores: ScoresResponse | null,
  ownPlayerId: string | null,
): readonly ResultsExplanationEntry[] {
  return (
    history?.history.flatMap((era) =>
      era.deltas.map((delta) => ({
        playerId: delta.playerId,
        playerName: playerNameFor(delta.playerId, players, scores),
        eraNumber: era.eraNumber,
        pointsDelta: delta.pointsDelta,
        reason: delta.reason || null,
        isOwn: ownPlayerId !== null && delta.playerId === ownPlayerId,
      })),
    ) ?? []
  )
}

/**
 * Builds the terminal results view from authoritative facts only. Winners,
 * ending cause and final scores come straight from the published result;
 * nothing is derived from score order or faction guesses. A terminal phase
 * without a complete result stays in `waiting` until the authoritative
 * final awards arrive. Factions and detailed reasons are shown only when
 * the recorded reveal boundary permits them; otherwise they remain
 * withheld and the view marks them as such.
 */
export function selectResultsView(
  state: GameStateView | null,
  scores: ScoresResponse | null,
  history: ScoresHistoryResponse | null,
  ownPlayerId: string | null,
): ResultsView {
  if (state?.phase !== 'GAME_ENDED') {
    return { kind: 'active' }
  }
  const result = state.result
  if (!result) {
    return { kind: 'waiting', gameId: state.gameId, eraNumber: state.eraNumber }
  }
  const isRevealed = result.revealBoundary === 'FACTIONS_AND_SCORES_PUBLIC'
  const players = state.players
  const ordered = orderedPlayersFrom(result, players, scores, isRevealed)

  return {
    kind: 'complete',
    gameId: state.gameId,
    endReason: result.endReason,
    winners: ordered.filter((entry) => entry.isWinner),
    scores: ordered,
    isRevealed,
    explanations: explanationsFrom(history, players, scores, ownPlayerId),
  }
}
