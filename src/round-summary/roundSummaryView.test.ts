import { describe, expect, it } from 'vitest'
import type { ActionSummary, PlayerInGame } from '../api/projection'
import { baseGameState as baseState } from '../game/gameStateFixtures'
import { selectRoundSummaryView } from './roundSummaryView'

const PLAYERS: PlayerInGame[] = [
  { playerId: 'p-1', playerName: 'Nora', score: 8, isConnected: true, faction: null },
  { playerId: 'p-2', playerName: 'Eli', score: 6, isConnected: true, faction: null },
  { playerId: 'p-3', playerName: 'Mara', score: 5, isConnected: true, faction: null },
]

function summaryState(summaries: ActionSummary[] | null, players: PlayerInGame[] = PLAYERS) {
  return baseState(
    {},
    {
      players,
      lastRoundSummary: summaries === null ? null : { roundNumber: 1, actionSummaries: summaries },
    },
  )
}

describe('selectRoundSummaryView', () => {
  it('reports unavailable when state has not loaded', () => {
    expect(selectRoundSummaryView(null)).toEqual({ kind: 'unavailable', reason: 'Game state is not loaded yet.' })
  })

  it('reports unavailable before the first round closes', () => {
    expect(selectRoundSummaryView(baseState({}, { players: PLAYERS })).kind).toBe('unavailable')
    expect(selectRoundSummaryView(summaryState(null)).kind).toBe('unavailable')
  })

  it('parses card, special, and skip entries with typed category and family', () => {
    const view = selectRoundSummaryView(
      summaryState([
        { playerId: 'p-1', actionCategory: 'PROBABILITY_SHIFTER', actionFamily: 'CARD', skipped: false },
        { playerId: 'p-2', actionCategory: null, actionFamily: 'SPECIAL', skipped: false },
        { playerId: 'p-3', actionCategory: null, actionFamily: null, skipped: true },
      ]),
    )
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.roundNumber).toBe(1)
    expect(view.entries).toEqual([
      {
        kind: 'card',
        playerId: 'p-1',
        playerName: 'Nora',
        actionFamily: 'CARD',
        familyLabel: 'Card',
        actionCategory: 'PROBABILITY_SHIFTER',
        categoryLabel: expect.any(String),
      },
      { kind: 'special', playerId: 'p-2', playerName: 'Eli' },
      { kind: 'skipped', playerId: 'p-3', playerName: 'Mara' },
    ])
  })

  it('shows a Decoy disguise exactly like a real card of the declared category', () => {
    const view = selectRoundSummaryView(summaryState([{ playerId: 'p-1', actionCategory: 'DISRUPTION', actionFamily: 'CARD', skipped: false }]))
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.entries).toEqual([
      expect.objectContaining({ kind: 'card', actionFamily: 'CARD', actionCategory: 'DISRUPTION' }),
    ])
  })

  it('drops a skipped entry carrying category or family as malformed', () => {
    const view = selectRoundSummaryView(
      summaryState([
        { playerId: 'p-1', actionCategory: 'INFORMATION', actionFamily: 'CARD', skipped: true },
        { playerId: 'p-2', actionCategory: null, actionFamily: 'SPECIAL', skipped: true },
        { playerId: 'p-3', actionCategory: null, actionFamily: null, skipped: true },
      ]),
    )
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.entries.map((entry) => entry.playerId)).toEqual(['p-3'])
  })

  it('drops entries that reveal more or less than their family allows', () => {
    const view = selectRoundSummaryView(
      summaryState([
        { playerId: 'p-1', actionCategory: null, actionFamily: 'CARD', skipped: false },
        { playerId: 'p-2', actionCategory: 'INFORMATION', actionFamily: 'SPECIAL', skipped: false },
        { playerId: 'p-4', actionCategory: 'PARADOX', actionFamily: null, skipped: false },
        { playerId: 'p-3', actionCategory: 'PARADOX', actionFamily: 'CARD', skipped: false },
      ]),
    )
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.entries.map((entry) => entry.playerId)).toEqual(['p-3'])
  })

  it('falls back to a stable label for a player absent from the roster', () => {
    const view = selectRoundSummaryView(summaryState([{ playerId: 'unknown-player-id', actionCategory: 'PARADOX', actionFamily: 'CARD', skipped: false }]))
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.entries[0]).toMatchObject({ playerId: 'unknown-player-id', playerName: 'Player unknown-' })
  })
})
