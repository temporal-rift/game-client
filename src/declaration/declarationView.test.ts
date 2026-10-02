import { describe, expect, it } from 'vitest'
import { baseGameState } from '../game/gameStateFixtures'
import { selectDeclarationView } from './declarationView'
import { uuid } from '../test/uuid'

const EVENT = uuid('event-1')
const OUTCOME = uuid('outcome-1')

function openState(overrides = {}) {
  return baseGameState(
    {
      phase: 'ERA_START',
      roundNumber: null,
      phaseContext: { declarationOpen: true, paradoxOpen: false },
      deadlines: {
        handSelectionExpiresAt: null,
        actionRoundExpiresAt: null,
        paradoxResolutionExpiresAt: null,
        declarationExpiresAt: '2030-01-01T00:01:30Z',
      },
      myEligibleDeclarationModes: ['RALLY'],
      activeEvents: [
        {
          eventId: EVENT,
          title: 'Reactor ignition',
          carryOverState: 'FRESH',
          outcomes: [{ outcomeId: OUTCOME, description: 'Ignition succeeds', initialProbability: 50 }],
        },
      ],
      ...overrides,
    },
    {},
  )
}

describe('selectDeclarationView', () => {
  it('offers the caller-owned eligible mode with its target events and deadline', () => {
    const view = selectDeclarationView(openState())

    expect(view).toMatchObject({
      kind: 'open',
      eraNumber: 2,
      deadline: '2030-01-01T00:01:30Z',
      eligibleModes: ['RALLY'],
    })
    if (view.kind === 'open') {
      expect(view.activeEvents).toHaveLength(1)
      expect(view.activeEvents[0].outcomes).toEqual([{ outcomeId: OUTCOME, description: 'Ignition succeeds' }])
    }
  })

  it('offers both modes when the server names both', () => {
    const view = selectDeclarationView(openState({ myEligibleDeclarationModes: ['RALLY', 'MOMENTUM'] }))

    expect(view).toMatchObject({ kind: 'open', eligibleModes: ['RALLY', 'MOMENTUM'] })
  })

  it('offers no control when the caller has no eligible modes', () => {
    const view = selectDeclarationView(openState({ myEligibleDeclarationModes: [] }))

    expect(view.kind).toBe('unavailable')
  })

  it('never infers Momentum eligibility from public history', () => {
    const view = selectDeclarationView(
      openState({
        myEligibleDeclarationModes: [],
        declarations: [{ playerId: 'p-1', mode: 'RALLY', targetEventId: EVENT, targetOutcomeId: OUTCOME, eraNumber: 1 }],
      }),
    )

    expect(view.kind).toBe('unavailable')
  })

  it('offers no control when the window is closed', () => {
    const view = selectDeclarationView(
      baseGameState({ phaseContext: { declarationOpen: false, paradoxOpen: false }, myEligibleDeclarationModes: ['RALLY'] }),
    )

    expect(view.kind).toBe('unavailable')
  })

  it('recovers an accepted declaration after reload instead of offering a second one', () => {
    const view = selectDeclarationView(
      openState({
        mySubmissions: [{ eraNumber: 2, roundNumber: null, window: 'DECLARATION', status: 'ACCEPTED' }],
      }),
    )

    expect(view).toMatchObject({ kind: 'submitted', eraNumber: 2 })
  })
})
