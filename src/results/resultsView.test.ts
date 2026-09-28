import { describe, expect, it } from 'vitest'
import type { GameStateView } from '../api/gameStateClient'
import type { ScoresHistoryView, ScoresView } from '../api/scoresClient'
import { selectResultsView } from './resultsView'

function terminalState(overrides: Record<string, unknown> = {}): GameStateView {
  return {
    gameId: 'game-1',
    eraNumber: 3,
    revision: 41,
    lastUpdatedAt: '2026-09-16T00:00:00Z',
    phase: 'GAME_ENDED',
    roundNumber: null,
    myFaction: 'PROPHETS',
    myScore: 12,
    deadlines: { handSelectionExpiresAt: null, actionRoundExpiresAt: null, paradoxResolutionExpiresAt: null },
    phaseContext: { declarationOpen: false, paradoxOpen: false, paradoxIds: [] },
    mySubmissions: [],
    mySpecialBudgets: [],
    result: {
      endReason: 'WIN_CONDITION_MET',
      winners: [
        { playerId: 'p-1', faction: 'PROPHETS', winType: 'SCORE_THRESHOLD' },
        { playerId: 'p-2', faction: 'ERASERS', winType: 'FACTION_OBJECTIVE' },
      ],
      finalScores: [
        { playerId: 'p-1', score: 20 },
        { playerId: 'p-2', score: 20 },
        { playerId: 'p-3', score: 12 },
      ],
      revealBoundary: 'FACTIONS_AND_SCORES_PUBLIC',
    },
    raw: {
      players: [
        { playerId: 'p-1', playerName: 'Nora', score: 20, faction: 'PROPHETS' },
        { playerId: 'p-2', playerName: 'Eli', score: 20, faction: 'ERASERS' },
        { playerId: 'p-3', playerName: 'You', score: 12, faction: 'WEAVERS' },
      ],
    },
    ...overrides,
  } as GameStateView
}

const scores: ScoresView = {
  gameId: 'game-1',
  eraNumber: 3,
  scores: [
    { playerId: 'p-1', playerName: 'Nora', score: 20, faction: 'PROPHETS' },
    { playerId: 'p-2', playerName: 'Eli', score: 20, faction: 'ERASERS' },
    { playerId: 'p-3', playerName: 'You', score: 12, faction: 'WEAVERS' },
  ],
}

const history: ScoresHistoryView = {
  gameId: 'game-1',
  history: [
    {
      eraNumber: 1,
      deltas: [
        { playerId: 'p-3', pointsDelta: 4, reason: 'EVENT_RESOLVED_AS_WRITTEN' },
        { playerId: 'p-1', pointsDelta: 2, reason: null },
      ],
    },
  ],
}

describe('selectResultsView', () => {
  it('shows every authoritative simultaneous winner with cause and final scores', () => {
    const view = selectResultsView(terminalState(), scores, history, 'p-3')

    expect(view.kind).toBe('complete')
    if (view.kind !== 'complete') {
      return
    }
    expect(view.endReason).toBe('WIN_CONDITION_MET')
    expect(view.winners.map((winner) => winner.playerId)).toEqual(['p-1', 'p-2'])
    expect(view.winners.map((winner) => winner.winType)).toEqual(['SCORE_THRESHOLD', 'FACTION_OBJECTIVE'])
    expect(view.scores.find((entry) => entry.playerId === 'p-3')?.winType).toBeNull()
    expect(view.scores).toHaveLength(3)
    expect(view.scores.find((entry) => entry.playerId === 'p-1')?.score).toBe(20)
  })

  it('uses the published special winner set instead of faction guesses', () => {
    const collapsed = terminalState({
      result: {
        endReason: 'TIMELINE_COLLAPSED',
        winners: [{ playerId: 'p-3', faction: 'ACTIVISTS', winType: null }],
        finalScores: [
          { playerId: 'p-1', score: 18 },
          { playerId: 'p-3', score: 6 },
        ],
        revealBoundary: 'FACTIONS_AND_SCORES_PUBLIC',
      },
    })
    const view = selectResultsView(collapsed, scores, history, 'p-3')

    expect(view.kind).toBe('complete')
    if (view.kind !== 'complete') {
      return
    }
    expect(view.endReason).toBe('TIMELINE_COLLAPSED')
    // The highest score does not win: the published special set wins.
    expect(view.winners.map((winner) => winner.playerId)).toEqual(['p-3'])
  })

  it('falls back to an unknown terminal view for a retired or unrecognized end reason', () => {
    const retired = terminalState({
      result: { endReason: 'SCORE_THRESHOLD', winners: [], finalScores: [], revealBoundary: 'FACTIONS_AND_SCORES_PUBLIC' },
    })
    const view = selectResultsView(retired, null, null, 'p-3')

    expect(view).toEqual({ kind: 'unknown-terminal', gameId: 'game-1', endReasonRaw: 'SCORE_THRESHOLD' })
  })

  it('shows an abnormal ending without winners', () => {
    const abnormal = terminalState({
      result: {
        endReason: 'DECK_EXHAUSTED',
        winners: [],
        finalScores: [{ playerId: 'p-3', score: 12 }],
        revealBoundary: 'FACTIONS_AND_SCORES_PUBLIC',
      },
    })
    const view = selectResultsView(abnormal, null, null, 'p-3')

    expect(view.kind).toBe('complete')
    if (view.kind !== 'complete') {
      return
    }
    expect(view.endReason).toBe('DECK_EXHAUSTED')
    expect(view.winners).toEqual([])
  })

  it('waits with readiness while the terminal result is not yet complete', () => {
    const pending = terminalState({ result: null })
    const view = selectResultsView(pending, null, null, 'p-3')

    expect(view).toMatchObject({ kind: 'waiting', gameId: 'game-1' })
  })

  it('withholds factions and opponent reasons before the recorded reveal boundary', () => {
    const unrevealed = terminalState({
      result: {
        endReason: 'WIN_CONDITION_MET',
        winners: [
          { playerId: 'p-1', faction: null, winType: 'SCORE_THRESHOLD' },
          { playerId: 'p-2', faction: null, winType: 'SCORE_THRESHOLD' },
        ],
        finalScores: [
          { playerId: 'p-1', score: 20 },
          { playerId: 'p-2', score: 20 },
        ],
        revealBoundary: 'WITHHELD',
      },
    })
    const view = selectResultsView(unrevealed, null, history, 'p-3')

    expect(view.kind).toBe('complete')
    if (view.kind !== 'complete') {
      return
    }
    expect(view.isRevealed).toBe(false)
    expect(view.winners.every((winner) => winner.faction === null)).toBe(true)
    const opponent = view.explanations.find((entry) => entry.playerId === 'p-1')
    expect(opponent?.reason).toBeNull()
    expect(opponent?.isOwn).toBe(false)
  })

  it('keeps owner-private entitlement on explanations after the reveal', () => {
    const view = selectResultsView(terminalState(), scores, history, 'p-3')

    expect(view.kind).toBe('complete')
    if (view.kind !== 'complete') {
      return
    }
    const own = view.explanations.find((entry) => entry.playerId === 'p-3')
    expect(own?.isOwn).toBe(true)
    expect(own?.reason).toBe('EVENT_RESOLVED_AS_WRITTEN')
  })

  it('stays in the active state while the game has not ended', () => {
    const active = terminalState({ phase: 'ACTION_ROUND_2', result: null })
    expect(selectResultsView(active, null, null, 'p-3')).toMatchObject({ kind: 'active' })
    expect(selectResultsView(null, null, null, null)).toMatchObject({ kind: 'active' })
  })
})
