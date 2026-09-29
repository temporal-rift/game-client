import { describe, expect, it } from 'vitest'
import type { ParadoxResolutionStatusResponse } from '../api/action'
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
      phaseContext: { declarationOpen: false, paradoxOpen: true, paradoxIds: ['opaque-paradox-id'] },
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

function status(overrides: Partial<ParadoxResolutionStatusResponse> = {}): ParadoxResolutionStatusResponse {
  return {
    eraNumber: 2,
    phaseOpen: true,
    timerRemainingSeconds: 30,
    submittedCount: 0,
    totalPlayers: 3,
    pendingPlayerIds: ['p1', 'p2', 'p3'],
    mySubmitted: false,
    affectedEventIds: ['affected'],
    eligibleResolutionCards: [{ cardInstanceId: 'offer-1', cardType: 'STABILIZE', grade: 'I' }],
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
    const view = selectParadoxResolutionView(state(), status({ affectedEventIds: [], eligibleResolutionCards: [] }))

    expect(view).toMatchObject({ kind: 'open', affectedEvents: [], cards: [] })
  })

  it('recovers an accepted caller submission and waits for authoritative completion', () => {
    const view = selectParadoxResolutionView(
      state({ mySubmissions: [{ eraNumber: 2, roundNumber: null, kind: 'PARADOX_CARD', status: 'ACCEPTED' }] }),
      status(),
    )

    expect(view).toMatchObject({ kind: 'submitted', submittedCount: 0, totalPlayers: 3 })
  })

  it('removes choices when the authoritative phase closes', () => {
    expect(selectParadoxResolutionView(state(), status({ phaseOpen: false }))).toMatchObject({ kind: 'closed' })
  })
})
