import type { GameStateView } from '../api/projection'
import { baseGameState } from '../game/gameStateFixtures'

export function boardKnowledgeState(overrides: Partial<GameStateView> = {}): GameStateView {
  return baseGameState({
    phase: 'ACTION_ROUND_3',
    roundNumber: 3,
    myFaction: 'PROPHETS',
    players: [
      { playerId: 'p-me', playerName: 'Ana', score: 8, isConnected: true, faction: null },
      { playerId: 'p-bo', playerName: 'Bo', score: 6, isConnected: true, faction: null },
      { playerId: 'p-cy', playerName: 'Cy', score: 5, isConnected: true, faction: null },
    ],
    activeEvents: [
      {
        eventId: 'event-1', title: 'Reactor ignition', carryOverState: 'FRESH',
        outcomes: [
          { outcomeId: 'outcome-1', description: 'Ignition succeeds', initialProbability: 50 },
          { outcomeId: 'outcome-2', description: 'Facility destroyed', initialProbability: 50 },
        ],
      },
      {
        eventId: 'event-2', title: 'Trade pact', carryOverState: 'CASCADED',
        outcomes: [{ outcomeId: 'outcome-1', description: 'Renegotiation', initialProbability: 100 }],
      },
    ],
    publicBands: [{ eventId: 'event-1', observedInRound: 2, outcomes: [{ outcomeId: 'outcome-1', band: 'HIGH' }, { outcomeId: 'outcome-2', band: 'LOW' }] }],
    myRevealedIntel: [
      { kind: 'PROBABILITY', eventId: 'event-1', observedInRound: 2, outcomes: [
        { outcomeId: 'outcome-1', probability: 62, isAnnihilated: false, isSealed: true },
        { outcomeId: 'outcome-2', probability: 0, isAnnihilated: true, isSealed: false },
      ] },
      { kind: 'INFLUENCE', eventId: 'event-1', observedInRound: 1, influencerPlayerIds: ['p-bo', 'p-cy'], mimicInfluencerPlayerIds: ['p-bo'] },
      { kind: 'INFLUENCE', eventId: 'event-1', observedInRound: 2, influencerPlayerIds: [], mimicInfluencerPlayerIds: [] },
      { kind: 'HAND_CARD', eventId: 'event-1', targetPlayerId: 'p-cy', observedInRound: 1, revealedCards: [{ cardInstanceId: 'card-1', cardType: 'SCAN', grade: 'II' }] },
    ],
    declarations: [
      { playerId: 'p-bo', mode: 'RALLY', targetEventId: 'event-1', targetOutcomeId: 'outcome-1', eraNumber: 2 },
      { playerId: 'p-cy', mode: 'MOMENTUM', targetEventId: 'event-2', targetOutcomeId: 'outcome-1', eraNumber: 2 },
    ],
    exposeFacts: [
      { activistPlayerId: 'p-bo', targetPlayerId: 'p-cy', roundNumber: 2, signature: { type: 'SWING', targetEventId: 'event-1' }, behaviorChanged: false },
      { activistPlayerId: 'p-bo', targetPlayerId: 'p-cy', roundNumber: 3, behaviorChanged: true },
    ],
    ...overrides,
  })
}
