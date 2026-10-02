import { describe, expect, it } from 'vitest'
import type { GameStateView } from '../api/projection'
import { baseGameState } from '../game/gameStateFixtures'
import { selectParadoxResolutionView } from './paradoxView'

function state(overrides: Partial<GameStateView> = {}): GameStateView {
  return baseGameState(
    {
      revision: 1,
      phase: 'PARADOX_RESOLUTION',
      roundNumber: 3,
      myFaction: null,
      myScore: 0,
      deadlines: { handSelectionExpiresAt: null, actionRoundExpiresAt: null, paradoxResolutionExpiresAt: '2026-01-01T00:00:30Z' },
      phaseContext: {
        declarationOpen: false,
        paradoxOpen: true,
        paradoxes: [{ paradoxId: 'paradox-1', type: 'DEAD_HEAT', affectedEventId: 'affected', affectedOutcomeIds: ['out-1'] }],
        affectedEventIds: ['affected'],
        paradoxResolutionProgress: { submittedCount: 1, totalPlayers: 3, pendingPlayerIds: ['p2', 'p3'] },
      },
      myEligibleResolutionCards: [{ cardInstanceId: 'offer-1', cardType: 'STABILIZE', grade: 'I' }],
      ...overrides,
    },
    {
      activeEvents: [
        { eventId: 'affected', title: 'Affected event', carryOverState: 'FRESH', outcomes: [{ outcomeId: 'out-1', description: 'First outcome', initialProbability: 100 }] },
        { eventId: 'unaffected', title: 'Other event', carryOverState: 'FRESH', outcomes: [{ outcomeId: 'out-2', description: 'Other outcome', initialProbability: 100 }] },
      ],
    },
  )
}

describe('selectParadoxResolutionView', () => {
  it('builds progress, deadline, affected events, typed paradoxes, and eligible cards from game state', () => {
    const view = selectParadoxResolutionView(state())

    expect(view).toMatchObject({
      kind: 'open',
      deadline: '2026-01-01T00:00:30Z',
      submittedCount: 1,
      totalPlayers: 3,
      paradoxes: [{ paradoxId: 'paradox-1', type: 'DEAD_HEAT', typeLabel: 'Dead Heat', affectedEventId: 'affected', affectedOutcomeIds: ['out-1'] }],
      cards: [{ cardInstanceId: 'offer-1', cardType: 'STABILIZE' }],
    })
    if (view.kind === 'open') expect(view.affectedEvents.map((event) => event.eventId)).toEqual(['affected'])
  })

  it.each([
    ['IMPOSSIBLE_ERASURE', 'Impossible Erasure'],
    ['CHAIN_CONFLICT', 'Chain Conflict'],
  ] as const)('names a %s paradox', (type, label) => {
    const view = selectParadoxResolutionView(
      state({
        phaseContext: {
          declarationOpen: false,
          paradoxOpen: true,
          paradoxes: [{ paradoxId: 'paradox-1', type, affectedEventId: 'affected', affectedOutcomeIds: ['out-1'] }],
          affectedEventIds: ['affected'],
        },
      }),
    )

    expect(view).toMatchObject({ kind: 'open', paradoxes: [{ typeLabel: label }] })
  })

  it('does not offer ordinary hand cards when eligible cards are absent or empty', () => {
    const ordinaryCard = { cardInstanceId: 'hand-card', cardType: 'PUSH' as const, grade: 'I' as const, isPlayableThisRound: true }
    const absent = selectParadoxResolutionView(state({ myEligibleResolutionCards: undefined, myHand: [ordinaryCard] }))
    const empty = selectParadoxResolutionView(state({ myEligibleResolutionCards: [], myHand: [ordinaryCard] }))

    expect(absent).toMatchObject({ kind: 'open', affectedEvents: [{ eventId: 'affected' }], cards: [] })
    expect(empty).toMatchObject({ kind: 'open', cards: [] })
  })

  it('recovers an accepted paradox-resolution pass from its window and choice', () => {
    const view = selectParadoxResolutionView(
      state({ mySubmissions: [{ eraNumber: 2, roundNumber: null, window: 'PARADOX_RESOLUTION', choice: 'PASS', status: 'ACCEPTED' }] }),
    )

    expect(view).toMatchObject({
      kind: 'submitted',
      submittedCount: 1,
      totalPlayers: 3,
      deadline: '2026-01-01T00:00:30Z',
      acceptedChoice: { summary: 'Pass', targets: [] },
      paradoxes: [{ type: 'DEAD_HEAT' }],
    })
  })

  it('describes an accepted card from the recorded submission', () => {
    const view = selectParadoxResolutionView(
      state({
        mySubmissions: [
          {
            eraNumber: 2,
            roundNumber: null,
            window: 'PARADOX_RESOLUTION',
            choice: 'CARD',
            status: 'ACCEPTED',
            card: { cardInstanceId: 'offer-1', cardType: 'PUSH', grade: 'II' },
            targets: { targetEventId: 'affected', targetOutcomeId: 'out-1' },
          },
        ],
      }),
    )

    expect(view).toMatchObject({
      kind: 'submitted',
      acceptedChoice: { summary: 'Push · Grade II', targets: ['Event: Affected event', 'Outcome: First outcome'] },
    })
  })

  it('does not offer choices outside an open paradox-resolution phase', () => {
    expect(selectParadoxResolutionView(state({ phaseContext: { declarationOpen: false, paradoxOpen: false } }))).toMatchObject({ kind: 'unavailable' })
  })
})
