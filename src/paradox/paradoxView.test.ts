import { describe, expect, it } from 'vitest'
import type { ParadoxResolutionStatusView } from '../api/actionClient'
import type { GameStateView } from '../api/gameStateClient'
import { selectParadoxResolutionView } from './paradoxView'

function state(overrides: Partial<GameStateView> = {}): GameStateView {
  return {
    gameId: 'game-1',
    eraNumber: 2,
    revision: 1,
    lastUpdatedAt: null,
    phase: 'PARADOX_RESOLUTION',
    roundNumber: 3,
    myFaction: null,
    myScore: 0,
    deadlines: { handSelectionExpiresAt: null, actionRoundExpiresAt: null, paradoxResolutionExpiresAt: '2026-01-01T00:00:30Z' },
    phaseContext: { declarationOpen: false, paradoxOpen: true, paradoxIds: ['opaque-paradox-id'] },
    mySubmissions: [],
    mySpecialBudgets: [],
    result: null,
    raw: {
      activeEvents: [
        { eventId: 'affected', title: 'Affected event', carryOverState: 'FRESH', outcomes: [{ outcomeId: 'out-1', description: 'First outcome' }] },
        { eventId: 'unaffected', title: 'Other event', carryOverState: 'FRESH', outcomes: [{ outcomeId: 'out-2', description: 'Other outcome' }] },
      ],
    },
    ...overrides,
  }
}

function status(overrides: Partial<ParadoxResolutionStatusView> = {}): ParadoxResolutionStatusView {
  return {
    eraNumber: 2,
    phaseOpen: true,
    timerRemainingSeconds: 30,
    submittedCount: 0,
    totalPlayers: 3,
    pendingPlayerIds: ['p1', 'p2', 'p3'],
    mySubmitted: false,
    affectedEventIds: ['affected'],
    eligibleCards: [{ cardInstanceId: 'offer-1', cardType: 'STABILIZE', grade: 'I' }],
    ...overrides,
  }
}

describe('selectParadoxResolutionView', () => {
  it('uses only status-provided offers and affected events', () => {
    const view = selectParadoxResolutionView(state(), status())

    expect(view).toMatchObject({ kind: 'open', cards: [{ cardInstanceId: 'offer-1', cardType: 'STABILIZE' }] })
    if (view.kind === 'open') expect(view.affectedEvents.map((event) => event.eventId)).toEqual(['affected'])
  })

  it('does not turn opaque phase IDs or ordinary cards into legal choices when status data is missing', () => {
    const view = selectParadoxResolutionView(state(), status({ affectedEventIds: [], eligibleCards: [] }))

    expect(view).toMatchObject({ kind: 'open', affectedEvents: [], cards: [] })
  })

  it('recovers an accepted caller submission and waits for authoritative completion', () => {
    const view = selectParadoxResolutionView(
      state({ mySubmissions: [{ eraNumber: 2, roundNumber: null, kind: 'PARADOX_CARD', actionType: 'CARD' }] }),
      status(),
    )

    expect(view).toMatchObject({ kind: 'submitted', submittedCount: 0, totalPlayers: 3 })
  })

  it('removes choices when the authoritative phase closes', () => {
    expect(selectParadoxResolutionView(state(), status({ phaseOpen: false }))).toMatchObject({ kind: 'closed' })
  })
})
