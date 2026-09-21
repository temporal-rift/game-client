import type { GameStateView } from '../api/gameStateClient'
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

function rawPlayersFrom(state: GameStateView): readonly RawPlayer[] {
  const raw = state.raw['players']
  if (!Array.isArray(raw)) {
    return []
  }
  const players: RawPlayer[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const playerId = typeof source['playerId'] === 'string' && source['playerId'].length > 0 ? source['playerId'] : null
    const score = typeof source['score'] === 'number' ? source['score'] : null
    if (!playerId || score === null) {
      continue
    }
    const playerName = typeof source['playerName'] === 'string' && source['playerName'].length > 0 ? source['playerName'] : null
    const faction = typeof source['faction'] === 'string' && source['faction'].length > 0 ? source['faction'] : null
    players.push({ playerId, playerName, score, faction })
  }
  return players
}

function playerNameFor(playerId: string, rawPlayers: readonly RawPlayer[], scores: ScoresView | null): string | null {
  const fromState = rawPlayers.find((player) => player.playerId === playerId)?.playerName ?? null
  if (fromState) {
    return fromState
  }
  return scores?.scores.find((score) => score.playerId === playerId)?.playerName ?? null
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
interface TerminalFacts {
  readonly endReason: EndReason
  readonly isRevealed: boolean
  readonly rawPlayers: readonly RawPlayer[]
  readonly winnerIds: ReadonlySet<string>
  readonly result: NonNullable<GameStateView['result']>
}

function terminalFactsFor(state: GameStateView): TerminalFacts | null {
  const result = state.result
  if (!result || !isKnownEndReason(result.endReason)) {
    return null
  }
  return {
    endReason: result.endReason,
    isRevealed: result.revealBoundary === 'FACTIONS_AND_SCORES_PUBLIC',
    rawPlayers: rawPlayersFrom(state),
    winnerIds: new Set(result.winners.map((winner) => winner.playerId)),
    result,
  }
}

function factionFor(
  playerId: string,
  facts: TerminalFacts,
  scores: ScoresView | null,
): string | null {
  if (!facts.isRevealed) {
    return null
  }
  const fromResult = facts.result.winners.find((winner) => winner.playerId === playerId)?.faction ?? null
  if (fromResult) {
    return fromResult
  }
  const fromScores = scores?.scores.find((score) => score.playerId === playerId)?.faction ?? null
  if (fromScores) {
    return fromScores
  }
  return facts.rawPlayers.find((player) => player.playerId === playerId)?.faction ?? null
}

function buildOrderedEntries(facts: TerminalFacts, scores: ScoresView | null): ResultsPlayerEntry[] {
  const scoreByPlayer = new Map(facts.result.finalScores.map((entry) => [entry.playerId, entry.score] as const))
  const playerIds = Array.from(
    new Set([
      ...facts.result.finalScores.map((entry) => entry.playerId),
      ...facts.result.winners.map((winner) => winner.playerId),
      ...facts.rawPlayers.map((player) => player.playerId),
    ]),
  )
  return playerIds.map((playerId) => ({
    playerId,
    playerName: playerNameFor(playerId, facts.rawPlayers, scores),
    score: scoreByPlayer.get(playerId) ?? facts.rawPlayers.find((player) => player.playerId === playerId)?.score ?? 0,
    isWinner: facts.winnerIds.has(playerId),
    faction: factionFor(playerId, facts, scores),
  }))
}

function buildExplanations(
  history: ScoresHistoryView | null,
  facts: TerminalFacts,
  scores: ScoresView | null,
  ownPlayerId: string | null,
): ResultsExplanationEntry[] {
  if (!history) {
    return []
  }
  return history.history.flatMap((era) =>
    era.deltas.map((delta) => ({
      playerId: delta.playerId,
      playerName: playerNameFor(delta.playerId, facts.rawPlayers, scores),
      eraNumber: era.eraNumber,
      pointsDelta: delta.pointsDelta,
      reason: delta.reason,
      isOwn: ownPlayerId !== null && delta.playerId === ownPlayerId,
    })),
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
  if (!state.result) {
    return { kind: 'waiting', gameId: state.gameId, eraNumber: state.eraNumber }
  }
  const facts = terminalFactsFor(state)
  if (!facts) {
    return { kind: 'unknown-terminal', gameId: state.gameId, endReasonRaw: state.result.endReason }
  }
  const ordered = buildOrderedEntries(facts, scores)
  return {
    kind: 'complete',
    gameId: state.gameId,
    endReason: facts.endReason,
    endReasonRaw: facts.endReason,
    winners: ordered.filter((entry) => entry.isWinner),
    scores: ordered,
    isRevealed: facts.isRevealed,
    explanations: buildExplanations(history, facts, scores, ownPlayerId),
  }
}
