import { describe, expect, it } from 'vitest'
import type { GameStateView } from '../api/projection'
import { boardKnowledgeState } from '../test/boardKnowledgeState'
import { toBoardView } from './boardView'

describe('board knowledge attribution', () => {
  it('attaches private Scan by both event and outcome id without converting public bands into probabilities', () => {
    const state = boardKnowledgeState()
    const view = toBoardView(state, 'p-me')
    expect(view.events[0].outcomes[0]).toMatchObject({
      band: 'high',
      privateProbabilities: [{ probability: 62, observedInRound: 2, expiresAtEraEnd: 2, isSealed: true }],
    })
    expect(view.events[0].outcomes[1].privateProbabilities[0]).toMatchObject({ probability: 0, isAnnihilated: true })
    expect(view.events[1].outcomes[0].privateProbabilities).toEqual([])
    const publicOnly = toBoardView({ ...state, myRevealedIntel: [] }, 'p-bo')
    expect(publicOnly.events[0].outcomes[0]).toMatchObject({ band: 'high', privateProbabilities: [] })
    expect(publicOnly.faction.earnedKnowledge).toEqual([])
  })

  it('preserves private observed records, including repeated Trace and empty influence results', () => {
    const view = toBoardView(boardKnowledgeState(), 'p-me')
    expect(view.faction.earnedKnowledge).toHaveLength(4)
    expect(view.events[0].traceKnowledge).toMatchObject([
      { observedInRound: 1, influencers: [{ playerId: 'p-bo', usedMimic: true }, { playerId: 'p-cy', usedMimic: false }] },
      { observedInRound: 2, influencers: [] },
    ])
    expect(view.events[1].traceKnowledge).toEqual([])
  })

  it('places declarations on their player and exact outcome and Expose on its target player and signature event', () => {
    const view = toBoardView(boardKnowledgeState(), 'p-me')
    expect(view.players[0]).toMatchObject({ declarations: [], exposeFacts: [] })
    expect(view.players[1].declarations[0]).toMatchObject({ playerName: 'Bo', mode: 'RALLY' })
    expect(view.players[2].exposeFacts).toHaveLength(2)
    expect(view.events[0].outcomes[0].declarations[0].mode).toBe('RALLY')
    expect(view.events[0].outcomes[1].declarations).toEqual([])
    expect(view.events[1].outcomes[0].declarations[0].mode).toBe('MOMENTUM')
    expect(view.events[0].exposeFacts).toMatchObject([{ signatureEventId: 'event-1', roundNumber: 2 }])
    expect(view.events[1].exposeFacts).toEqual([])
  })

  it('uses identifiers when titles coincide and preserves observations about absent subjects without assigning them elsewhere', () => {
    const state = boardKnowledgeState()
    const view = toBoardView({ ...state, activeEvents: state.activeEvents.map((event) => ({ ...event, title: 'Same title' })) }, 'p-me')
    expect(view.events[1].exposeFacts).toEqual([])
    expect(view.events[1].traceKnowledge).toEqual([])
    expect(view.events[1].outcomes[0].privateProbabilities).toEqual([])
    const absent = toBoardView({ ...state, activeEvents: [state.activeEvents[1]] }, 'p-me')
    expect(absent.faction.earnedKnowledge).toHaveLength(4)
    expect(absent.events[0].exposeFacts).toEqual([])
    expect(absent.events[0].outcomes[0].declarations).toHaveLength(1)
    expect(absent.players[1].declarations[0].eventTitle).toBe('Event event-1')
    expect(absent.players[2].exposeFacts[0].signatureEventTitle).toBe('Event event-1')
  })

  it('preserves the age of multiple probability observations for the same outcome', () => {
    const state = boardKnowledgeState()
    const scan = state.myRevealedIntel[0]
    const view = toBoardView({ ...state, myRevealedIntel: [scan, { ...scan, observedInRound: 3 }] }, 'p-me')
    expect(view.events[0].outcomes[0].privateProbabilities.map((entry) => entry.observedInRound)).toEqual([2, 3])
    expect(view.faction.earnedKnowledge).toHaveLength(2)
  })

  it('ignores unrecognized private fields in the served state and observation entries', () => {
    const state = boardKnowledgeState()
    const untrusted = {
      ...state,
      otherPlayersIntel: 'LEAK-MARKER',
      declarations: state.declarations?.map((entry) => ({ ...entry, opponentHand: 'LEAK-MARKER' })),
      exposeFacts: state.exposeFacts?.map((entry) => ({ ...entry, responseSignature: 'LEAK-MARKER' })),
      myRevealedIntel: state.myRevealedIntel.map((entry) => ({ ...entry, secretField: 'LEAK-MARKER' })),
    } as GameStateView
    expect(JSON.stringify(toBoardView(untrusted, 'p-me'))).not.toContain('LEAK-MARKER')
  })
})
