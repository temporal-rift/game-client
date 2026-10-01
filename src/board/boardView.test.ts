import { describe, expect, it } from 'vitest'
import type { ActiveEvent, PlayerInGame } from '../api/projection'
import { baseGameState } from '../game/gameStateFixtures'
import { toBoardView } from './boardView'

const PLAYERS: PlayerInGame[] = [
  { playerId: 'p-me', playerName: 'Ana', score: 8, isConnected: true, faction: null },
  { playerId: 'p-bo', playerName: 'Bo', score: 6, isConnected: true, faction: null },
  { playerId: 'p-cy-0000-0000', playerName: null, score: 5, isConnected: true, faction: 'WEAVERS' },
]

const EVENTS: ActiveEvent[] = [
  {
    eventId: 'evt-1',
    title: 'Reactor ignition',
    carryOverState: 'FRESH',
    outcomes: [
      { outcomeId: 'out-1a', description: 'Ignition succeeds', initialProbability: 50 },
      { outcomeId: 'out-1b', description: 'Facility destroyed', initialProbability: 50 },
    ],
  },
  {
    eventId: 'evt-2',
    title: 'Trade pact',
    carryOverState: 'CASCADED',
    outcomes: [{ outcomeId: 'out-2a', description: 'Renegotiation', initialProbability: 100 }],
  },
]

describe('toBoardView', () => {
  it('shows the real era, round of the contract-defined rounds, phase and the action-round deadline', () => {
    const state = baseGameState({
      eraNumber: 1,
      phase: 'ACTION_ROUND_2',
      roundNumber: 2,
      deadlines: { actionRoundExpiresAt: '2026-10-02T10:00:00Z', handSelectionExpiresAt: '2026-10-02T09:00:00Z' },
    })

    expect(toBoardView(state, 'p-me').header).toEqual({
      eraNumber: 1,
      phaseLabel: 'Action round',
      round: { number: 2, of: 3 },
      deadline: '2026-10-02T10:00:00Z',
    })
  })

  it('shows no round outside action rounds and paradox resolution, and the deadline of the current phase only', () => {
    const state = baseGameState({
      phase: 'HAND_SELECTION',
      roundNumber: null,
      deadlines: { handSelectionExpiresAt: '2026-10-02T09:00:00Z', actionRoundExpiresAt: '2026-10-02T10:00:00Z' },
    })

    expect(toBoardView(state, 'p-me').header).toMatchObject({ phaseLabel: 'Hand selection', round: null, deadline: '2026-10-02T09:00:00Z' })
    expect(toBoardView(baseGameState({ phase: 'ERA_END', roundNumber: null }), 'p-me').header.deadline).toBeNull()
  })

  it('lists every player by roster name, marks the current player, and keeps unrevealed factions hidden', () => {
    const state = baseGameState({ myFaction: 'PROPHETS', players: PLAYERS })

    expect(toBoardView(state, 'p-me').players).toEqual([
      { playerId: 'p-me', name: 'Ana', score: 8, isCurrentPlayer: true, factionName: 'Prophets' },
      { playerId: 'p-bo', name: 'Bo', score: 6, isCurrentPlayer: false, factionName: null },
      { playerId: 'p-cy-0000-0000', name: 'Player p-cy-000', score: 5, isCurrentPlayer: false, factionName: 'Weavers' },
    ])
  })

  it('marks no player and shows no own faction on the strip when the lobby does not identify the caller', () => {
    const players = toBoardView(baseGameState({ myFaction: 'PROPHETS', players: PLAYERS }), null).players

    expect(players.every((player) => !player.isCurrentPlayer)).toBe(true)
    expect(players[0].factionName).toBeNull()
  })

  it('shows the own score against the transmitted threshold and each own special with its budgets', () => {
    const state = baseGameState({
      myFaction: 'PROPHETS',
      myScore: 8,
      winScoreThreshold: 25,
      mySpecialActions: ['FORESIGHT', 'SEAL', 'FULFILLMENT'],
      mySpecialBudgets: [
        { specialAction: 'SEAL', remainingUsesThisEra: 1, remainingUsesThisGame: 2 },
        { specialAction: 'FORESIGHT', remainingUsesThisEra: 0, remainingUsesThisGame: 3 },
      ],
    })

    const faction = toBoardView(state, 'p-me').faction

    expect(faction).toMatchObject({ faction: 'PROPHETS', factionName: 'Prophets', score: 8, winScoreThreshold: 25 })
    expect(faction.specials).toEqual([
      { specialAction: 'FORESIGHT', name: 'Foresight', remainingThisEra: 0, remainingThisGame: 3 },
      { specialAction: 'SEAL', name: 'Seal', remainingThisEra: 1, remainingThisGame: 2 },
      { specialAction: 'FULFILLMENT', name: 'Fulfillment', remainingThisEra: null, remainingThisGame: null },
    ])
  })

  it('reports no faction and no specials before a faction is assigned', () => {
    const faction = toBoardView(baseGameState({ myFaction: null, mySpecialActions: [] }), 'p-me').faction

    expect(faction).toMatchObject({ faction: null, factionName: null, specials: [] })
  })

  it('shows published bands with their round and unknown bands where none are published', () => {
    const state = baseGameState({
      activeEvents: EVENTS,
      publicBands: [{ eventId: 'evt-1', observedInRound: 2, outcomes: [{ outcomeId: 'out-1a', band: 'HIGH' }, { outcomeId: 'out-1b', band: 'LOW' }] }],
    })

    expect(toBoardView(state, 'p-me').events).toEqual([
      {
        eventId: 'evt-1',
        title: 'Reactor ignition',
        carryOverState: 'FRESH',
        bandsObservedInRound: 2,
        outcomes: [
          { outcomeId: 'out-1a', description: 'Ignition succeeds', band: 'high' },
          { outcomeId: 'out-1b', description: 'Facility destroyed', band: 'low' },
        ],
      },
      {
        eventId: 'evt-2',
        title: 'Trade pact',
        carryOverState: 'CASCADED',
        bandsObservedInRound: null,
        outcomes: [{ outcomeId: 'out-2a', description: 'Renegotiation', band: 'unknown' }],
      },
    ])
  })

  it('never carries an exact weight onto the board', () => {
    const view = toBoardView(baseGameState({ activeEvents: EVENTS }), 'p-me')

    expect(JSON.stringify(view)).not.toContain('initialProbability')
  })

  it('reports open action-round progress and whether the current player is still pending', () => {
    const state = baseGameState({
      phase: 'ACTION_ROUND_1',
      phaseContext: {
        declarationOpen: false,
        paradoxOpen: false,
        actionRoundProgress: { submittedCount: 1, totalPlayers: 3, pendingPlayerIds: ['p-me', 'p-bo'] },
      },
    })

    expect(toBoardView(state, 'p-me').roundStatus).toEqual({ submittedCount: 1, totalPlayers: 3, hasSubmitted: false })
    expect(toBoardView(state, 'p-cy').roundStatus?.hasSubmitted).toBe(true)
    expect(toBoardView(state, null).roundStatus?.hasSubmitted).toBeNull()
  })

  it('reports paradox-resolution progress during paradox resolution and none outside a decision window', () => {
    const phaseContext = {
      declarationOpen: false,
      paradoxOpen: true,
      actionRoundProgress: { submittedCount: 3, totalPlayers: 3, pendingPlayerIds: [] },
      paradoxResolutionProgress: { submittedCount: 0, totalPlayers: 3, pendingPlayerIds: ['p-me'] },
    }

    expect(toBoardView(baseGameState({ phase: 'PARADOX_RESOLUTION', phaseContext }), 'p-me').roundStatus).toEqual({
      submittedCount: 0,
      totalPlayers: 3,
      hasSubmitted: false,
    })
    expect(toBoardView(baseGameState({ phase: 'RESOLUTION', phaseContext }), 'p-me').roundStatus).toBeNull()
  })

  it('shows the real hand with names, grades, effects and round playability', () => {
    const state = baseGameState({
      myHand: [
        { cardInstanceId: 'c-1', cardType: 'PUSH', grade: 'II', isPlayableThisRound: true },
        { cardInstanceId: 'c-2', cardType: 'SCAN', grade: 'I', isPlayableThisRound: false },
      ],
    })

    expect(toBoardView(state, 'p-me').hand).toMatchObject([
      { cardInstanceId: 'c-1', cardType: 'PUSH', name: 'Push', grade: 'II', isPlayableThisRound: true },
      { cardInstanceId: 'c-2', cardType: 'SCAN', name: 'Scan', grade: 'I', isPlayableThisRound: false },
    ])
    expect(toBoardView(state, 'p-me').hand[0].effect).not.toBe('')
  })
})
