import type { GameResultView, GameStateView } from '../api/gameStateClient'
import type { ScoresHistoryView, ScoresView } from '../api/scoresClient'

export type EndReason =
  | 'SCORE_THRESHOLD'
  | 'TIMELINE_COLLAPSED'
  | 'TIMELINE_STABILIZED'
  | 'DECK_EXHAUSTED'
  | 'RESOLUTION_FAILED'
  | 'ALL_PLAYERS_ABANDONED'

const KNOWN_END_REASONS: readonly string[] = [
  'SCORE_THRESHOLD',
  'TIMELINE_COLLAPSED',
  'TIMELINE_STABILIZED',
  'DECK_EXHAUSTED',
  'RESOLUTION_FAILED',
  'ALL_PLAYERS_ABANDONED',
]

export function isKnownEndReason(value: string): value is EndReason {
  return (KNOWN_END_REASONS as readonly string[]).includes(value)
}

export function endReasonLabel(endReason: string): string {
  switch (endReason) {
    case 'SCORE_THRESHOLD':
      return 'Score threshold reached'
    case 'TIMELINE_COLLAPSED':
      return 'Timeline collapsed'
    case 'TIMELINE_STABILIZED':
      return 'Timeline stabilized'
    case 'DECK_EXHAUSTED':
      return 'Card supply exhausted'
    case 'RESOLUTION_FAILED':
      return 'Final resolution could not complete'
    case 'ALL_PLAYERS_ABANDONED':
      return 'All players left the game'
    default:
      return endReason
  }
}

export interface ResultsPlayerEntry {
  readonly playerId: string
  readonly playerName: string | null
  readonly score: number
  readonly isWinner: boolean
  /** Permitted final faction; null while withheld before the recorded reveal boundary. */
  readonly faction: string | null
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
      readonly endReasonRaw: string
      readonly winners: readonly ResultsPlayerEntry[]
      readonly scores: readonly ResultsPlayerEntry[]
      readonly isRevealed: boolean
      readonly explanations: readonly ResultsExplanationEntry[]
    }
  | { readonly kind: 'unknown-terminal'; readonly gameId: string; readonly endReasonRaw: string }

interface RawPlayer {
  readonly playerId: string
  readonly playerName: string | null
  readonly score: number
  readonly faction: string | null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function parseRawPlayer(entry: unknown): RawPlayer | null {
  if (typeof entry !== 'object' || entry === null) {
    return null
  }
  const source = entry as Record<string, unknown>
  const playerId = nonEmptyString(source['playerId'])
  const score = typeof source['score'] === 'number' ? source['score'] : null
  if (!playerId || score === null) {
    return null
  }
  return { playerId, playerName: nonEmptyString(source['playerName']), score, faction: nonEmptyString(source['faction']) }
}

function rawPlayersFrom(state: GameStateView): readonly RawPlayer[] {
  const raw = state.raw['players']
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.flatMap((entry) => {
    const player = parseRawPlayer(entry)
    return player ? [player] : []
  })
}

function playerNameFor(playerId: string, rawPlayers: readonly RawPlayer[], scores: ScoresView | null): string | null {
  const fromState = rawPlayers.find((player) => player.playerId === playerId)?.playerName ?? null
  if (fromState) {
    return fromState
  }
  return scores?.scores.find((score) => score.playerId === playerId)?.playerName ?? null
}

function factionForPlayer(
  playerId: string,
  isRevealed: boolean,
  result: GameResultView,
  scores: ScoresView | null,
  rawPlayers: readonly RawPlayer[],
): string | null {
  if (!isRevealed) {
    return null
  }
  const fromResult = result.winners.find((winner) => winner.playerId === playerId)?.faction ?? null
  if (fromResult) {
    return fromResult
  }
  const fromScores = scores?.scores.find((score) => score.playerId === playerId)?.faction ?? null
  if (fromScores) {
    return fromScores
  }
  return rawPlayers.find((player) => player.playerId === playerId)?.faction ?? null
}

function orderedPlayersFrom(
  result: GameResultView,
  rawPlayers: readonly RawPlayer[],
  scores: ScoresView | null,
  isRevealed: boolean,
): readonly ResultsPlayerEntry[] {
  const winnerIds = new Set(result.winners.map((winner) => winner.playerId))
  const scoreByPlayer = new Map(result.finalScores.map((entry) => [entry.playerId, entry.score] as const))
  const playerIds = Array.from(
    new Set([
      ...result.finalScores.map((entry) => entry.playerId),
      ...result.winners.map((winner) => winner.playerId),
      ...rawPlayers.map((player) => player.playerId),
    ]),
  )
  return playerIds.map((playerId) => ({
    playerId,
    playerName: playerNameFor(playerId, rawPlayers, scores),
    score: scoreByPlayer.get(playerId) ?? rawPlayers.find((player) => player.playerId === playerId)?.score ?? 0,
    isWinner: winnerIds.has(playerId),
    faction: factionForPlayer(playerId, isRevealed, result, scores, rawPlayers),
  }))
}

function explanationsFrom(
  history: ScoresHistoryView | null,
  rawPlayers: readonly RawPlayer[],
  scores: ScoresView | null,
  ownPlayerId: string | null,
): readonly ResultsExplanationEntry[] {
  return (
    history?.history.flatMap((era) =>
      era.deltas.map((delta) => ({
        playerId: delta.playerId,
        playerName: playerNameFor(delta.playerId, rawPlayers, scores),
        eraNumber: era.eraNumber,
        pointsDelta: delta.pointsDelta,
        reason: delta.reason,
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
  scores: ScoresView | null,
  history: ScoresHistoryView | null,
  ownPlayerId: string | null,
): ResultsView {
  if (state?.phase !== 'GAME_ENDED') {
    return { kind: 'active' }
  }
  const result = state.result
  if (!result) {
    return { kind: 'waiting', gameId: state.gameId, eraNumber: state.eraNumber }
  }
  if (!isKnownEndReason(result.endReason)) {
    return { kind: 'unknown-terminal', gameId: state.gameId, endReasonRaw: result.endReason }
  }
  const isRevealed = result.revealBoundary === 'FACTIONS_AND_SCORES_PUBLIC'
  const rawPlayers = rawPlayersFrom(state)
  const ordered = orderedPlayersFrom(result, rawPlayers, scores, isRevealed)

  return {
    kind: 'complete',
    gameId: state.gameId,
    endReason: result.endReason,
    endReasonRaw: result.endReason,
    winners: ordered.filter((entry) => entry.isWinner),
    scores: ordered,
    isRevealed,
    explanations: explanationsFrom(history, rawPlayers, scores, ownPlayerId),
  }
}
