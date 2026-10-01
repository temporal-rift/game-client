import { describe, expect, it } from 'vitest'
import type { ActiveEvent, GameStateView, PlayerInGame } from '../api/projection'
import { baseGameState as baseState } from '../game/gameStateFixtures'
import { selectKnowledgeView } from './knowledgeView'

const ACTIVE_EVENTS: ActiveEvent[] = [
  {
    eventId: 'event-1',
    title: 'The Delegate Arrives',
    carryOverState: 'FRESH',
    outcomes: [
      { outcomeId: 'outcome-1', description: 'Accepted', initialProbability: 50 },
      { outcomeId: 'outcome-2', description: 'Rejected', initialProbability: 30 },
      { outcomeId: 'outcome-3', description: 'Delayed', initialProbability: 20 },
    ],
  },
]

const PLAYERS: PlayerInGame[] = [
  { playerId: 'p-1', playerName: 'Nora', score: 8, isConnected: true, faction: null },
  { playerId: 'p-2', playerName: 'Eli', score: 6, isConnected: true, faction: null },
]

describe('selectKnowledgeView', () => {
  it('reports unavailable when state has not loaded', () => {
    expect(selectKnowledgeView(null)).toEqual({ kind: 'unavailable', reason: 'Game state is not loaded yet.' })
  })

  it('parses public bands with event/outcome titles', () => {
    const state = baseState(
      {},
      {
        activeEvents: ACTIVE_EVENTS,
        publicBands: [
          {
            eventId: 'event-1',
            observedInRound: 2,
            outcomes: [
              { outcomeId: 'outcome-1', band: 'HIGH' },
              { outcomeId: 'outcome-2', band: 'LOW' },
              { outcomeId: 'outcome-3', band: 'MEDIUM' },
            ],
          },
        ],
      },
    )
    const view = selectKnowledgeView(state)
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.bands).toEqual([
      {
        eventId: 'event-1',
        eventTitle: 'The Delegate Arrives',
        observedInRound: 2,
        outcomes: [
          { outcomeId: 'outcome-1', outcomeDescription: 'Accepted', band: 'high' },
          { outcomeId: 'outcome-2', outcomeDescription: 'Rejected', band: 'low' },
          { outcomeId: 'outcome-3', outcomeDescription: 'Delayed', band: 'medium' },
        ],
      },
    ])
  })

  it('parses own earned probability knowledge with exact weights and era-end expiry', () => {
    const state = baseState(
      { eraNumber: 2 },
      {
        activeEvents: ACTIVE_EVENTS,
        myRevealedIntel: [
          {
            kind: 'PROBABILITY',
            observedInRound: 2,
            eventId: 'event-1',
            outcomes: [{ outcomeId: 'outcome-1', probability: 45, isAnnihilated: false, isSealed: false }],
          },
        ],
      },
    )
    const view = selectKnowledgeView(state)
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.revealedKnowledge).toEqual([
      {
        kind: 'PROBABILITY',
        eventId: 'event-1',
        eventTitle: 'The Delegate Arrives',
        observedInRound: 2,
        expiresAtEraEnd: 2,
        outcomes: [{ outcomeId: 'outcome-1', outcomeDescription: 'Accepted', probability: 45, isAnnihilated: false, isSealed: false }],
      },
    ])
  })

  it('marks only Mimic influencers as revealed Revisionists in own earned Trace knowledge', () => {
    const state = baseState(
      {},
      {
        activeEvents: ACTIVE_EVENTS,
        players: PLAYERS,
        myRevealedIntel: [
          { kind: 'INFLUENCE', observedInRound: 2, eventId: 'event-1', influencerPlayerIds: ['p-1', 'p-2'], mimicInfluencerPlayerIds: ['p-1'] },
        ],
      },
    )
    const view = selectKnowledgeView(state)
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.revealedKnowledge).toEqual([
      {
        kind: 'INFLUENCE',
        eventId: 'event-1',
        eventTitle: 'The Delegate Arrives',
        observedInRound: 2,
        expiresAtEraEnd: 2,
        influencers: [
          { playerId: 'p-1', playerName: 'Nora', usedMimic: true },
          { playerId: 'p-2', playerName: 'Eli', usedMimic: false },
        ],
      },
    ])
  })

  it('retains an empty Trace without inventing an influencer or Mimic attribution', () => {
    const state = baseState(
      {},
      {
        activeEvents: ACTIVE_EVENTS,
        myRevealedIntel: [
          { kind: 'INFLUENCE', observedInRound: 2, eventId: 'event-1', influencerPlayerIds: [], mimicInfluencerPlayerIds: [] },
        ],
      },
    )
    const view = selectKnowledgeView(state)
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.revealedKnowledge).toEqual([
      {
        kind: 'INFLUENCE',
        eventId: 'event-1',
        eventTitle: 'The Delegate Arrives',
        observedInRound: 2,
        expiresAtEraEnd: 2,
        influencers: [],
      },
    ])
  })

  it('parses own earned hand-card knowledge with resolved player and card names', () => {
    const state = baseState(
      {},
      {
        players: PLAYERS,
        myRevealedIntel: [
          {
            kind: 'HAND_CARD',
            observedInRound: 1,
            eventId: 'event-1',
            targetPlayerId: 'p-2',
            revealedCards: [{ cardInstanceId: 'card-1', cardType: 'SWING', grade: 'III' }],
          },
        ],
      },
    )
    const view = selectKnowledgeView(state)
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.revealedKnowledge).toEqual([
      {
        kind: 'HAND_CARD',
        targetPlayerId: 'p-2',
        targetPlayerName: 'Eli',
        observedInRound: 1,
        expiresAtEraEnd: 2,
        revealedCards: [{ cardInstanceId: 'card-1', cardType: 'SWING', cardName: 'Swing', grade: 'III' }],
      },
    ])
  })

  it('is empty for a player who bought no intel this era, never null', () => {
    const view = selectKnowledgeView(baseState())
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.revealedKnowledge).toEqual([])
  })

  it('parses already-broadcast declarations of record', () => {
    const state = baseState(
      { eraNumber: 2 },
      {
        activeEvents: ACTIVE_EVENTS,
        players: PLAYERS,
        declarations: [{ playerId: 'p-1', mode: 'RALLY', targetEventId: 'event-1', targetOutcomeId: 'outcome-1', eraNumber: 2 }],
      },
    )
    const view = selectKnowledgeView(state)
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.declarations).toEqual([
      {
        playerId: 'p-1',
        playerName: 'Nora',
        mode: 'RALLY',
        modeName: 'Rally',
        eventId: 'event-1',
        eventTitle: 'The Delegate Arrives',
        outcomeId: 'outcome-1',
        outcomeDescription: 'Accepted',
        eraNumber: 2,
      },
    ])
  })

  it('parses already-broadcast Expose facts, including a behavior-unchanged result', () => {
    const state = baseState(
      {},
      {
        activeEvents: ACTIVE_EVENTS,
        players: PLAYERS,
        exposeFacts: [
          {
            activistPlayerId: 'p-1',
            targetPlayerId: 'p-2',
            roundNumber: 2,
            signature: { type: 'SWING', targetEventId: 'event-1', sourceOutcomeId: 'outcome-1', targetOutcomeId: 'outcome-2' },
            behaviorChanged: false,
          },
        ],
      },
    )
    const view = selectKnowledgeView(state)
    if (view.kind !== 'ready') throw new Error('expected ready view')
    expect(view.exposeFacts).toEqual([
      {
        activistPlayerId: 'p-1',
        activistPlayerName: 'Nora',
        targetPlayerId: 'p-2',
        targetPlayerName: 'Eli',
        roundNumber: 2,
        signatureCardName: 'Swing',
        signatureEventTitle: 'The Delegate Arrives',
        behaviorChanged: false,
      },
    ])
  })

  it('never surfaces an unrecognized field, even one placed directly on a knowledge/band/declaration entry', () => {
    // Schemas validate the contract's fields but pass the served body through, extra keys included.
    const slices = {
        activeEvents: ACTIVE_EVENTS,
        players: PLAYERS,
        publicBands: [{ eventId: 'event-1', observedInRound: 2, outcomes: [{ outcomeId: 'outcome-1', band: 'HIGH', secretOpponentHand: 'LEAK-MARKER' }] }],
        myRevealedIntel: [
          { kind: 'INFLUENCE', observedInRound: 2, eventId: 'event-1', influencerPlayerIds: ['p-1'], secretOpponentHand: 'LEAK-MARKER' },
        ],
        declarations: [
          { playerId: 'p-1', mode: 'RALLY', targetEventId: 'event-1', targetOutcomeId: 'outcome-1', eraNumber: 2, secretOpponentHand: 'LEAK-MARKER' },
        ],
        exposeFacts: [
          {
            activistPlayerId: 'p-1',
            targetPlayerId: 'p-2',
            roundNumber: 2,
            signature: { type: 'SWING', targetEventId: 'event-1' },
            behaviorChanged: false,
            secretOpponentHand: 'LEAK-MARKER',
          },
        ],
      }
    const view = selectKnowledgeView(baseState({}, slices as unknown as Partial<GameStateView>))
    expect(JSON.stringify(view)).not.toContain('LEAK-MARKER')
  })
})
