import { describe, expect, it } from 'vitest'
import { baseGameState as baseState } from '../game/gameStateFixtures'
import { selectActionRoundView } from './actionView'

describe('selectActionRoundView', () => {
  it('reports unavailable when state has not loaded', () => {
    expect(selectActionRoundView(null)).toEqual({ kind: 'unavailable', reason: 'Game state is not loaded yet.' })
  })

  it('reports unavailable outside an open action round', () => {
    const state = baseState({ phase: 'ERA_START', roundNumber: null })
    expect(selectActionRoundView(state).kind).toBe('unavailable')
  })

  it('parses the hand with grade, effect summary and target mode', () => {
    const state = baseState(
      {},
      {
        myHand: [
          { cardInstanceId: 'card-1', cardType: 'PUSH', grade: 'II', isPlayableThisRound: true },
          { cardInstanceId: 'card-2', cardType: 'SCAN', grade: 'I', isPlayableThisRound: false },
        ],
      },
    )
    const view = selectActionRoundView(state)
    if (view.kind !== 'open') throw new Error('expected open view')
    expect(view.hand).toEqual([
      {
        cardInstanceId: 'card-1',
        cardType: 'PUSH',
        grade: 'II',
        name: 'Push',
        effectSummary: expect.stringContaining('Increases'),
        targetMode: 'EVENT_OUTCOME',
        isPlayableThisRound: true,
      },
      {
        cardInstanceId: 'card-2',
        cardType: 'SCAN',
        grade: 'I',
        name: 'Scan',
        effectSummary: expect.stringContaining('Reveals exact probabilities'),
        targetMode: 'EVENT_LIST',
        isPlayableThisRound: false,
      },
    ])
  })

  it('drops malformed hand entries instead of throwing', () => {
    const state = baseState({}, { myHand: [{ cardInstanceId: 'card-1' }, { cardInstanceId: 'card-2', cardType: 'PUSH', grade: 'X' }] })
    const view = selectActionRoundView(state)
    if (view.kind !== 'open') throw new Error('expected open view')
    expect(view.hand).toEqual([])
  })

  it('parses active events and their outcomes', () => {
    const state = baseState(
      {},
      {
        activeEvents: [
          {
            eventId: 'evt-1',
            title: 'The Reactor',
            carryOverState: 'FRESH',
            outcomes: [
              { outcomeId: 'out-1', description: 'Succeeds' },
              { outcomeId: 'out-2', description: 'Fails' },
            ],
          },
        ],
      },
    )
    const view = selectActionRoundView(state)
    if (view.kind !== 'open') throw new Error('expected open view')
    expect(view.activeEvents).toEqual([
      {
        eventId: 'evt-1',
        title: 'The Reactor',
        carryOverState: 'FRESH',
        outcomes: [
          { outcomeId: 'out-1', description: 'Succeeds' },
          { outcomeId: 'out-2', description: 'Fails' },
        ],
      },
    ])
  })

  it('filters specials to the ones the faction owns and excludes declaration-only specials', () => {
    const state = baseState({ myFaction: 'ERASERS' }, { mySpecialActions: ['ANNIHILATE', 'CORRUPT', 'CASCADE'] })
    const view = selectActionRoundView(state)
    if (view.kind !== 'open') throw new Error('expected open view')
    expect(view.specials.map((s) => s.specialAction).sort()).toEqual(['ANNIHILATE', 'CASCADE', 'CORRUPT'])
  })

  it('excludes Rally/Momentum for Activists even if present in mySpecialActions', () => {
    const state = baseState({ myFaction: 'ACTIVISTS' }, { mySpecialActions: ['RALLY', 'EXPOSE', 'MOMENTUM'] })
    const view = selectActionRoundView(state)
    if (view.kind !== 'open') throw new Error('expected open view')
    expect(view.specials.map((s) => s.specialAction)).toEqual(['EXPOSE'])
  })

  it('reports jam-driven unavailability for specials from myJammedUntilRound', () => {
    const state = baseState({ myFaction: 'ERASERS', roundNumber: 1 }, { mySpecialActions: ['ANNIHILATE'], myJammedUntilRound: 1 })
    const view = selectActionRoundView(state)
    if (view.kind !== 'open') throw new Error('expected open view')
    expect(view.specials[0]?.available).toBe(false)
    expect(view.specials[0]?.unavailableReason).toMatch(/jammed/i)
  })

  it('carries remaining-use budgets onto special options', () => {
    const state = baseState(
      { myFaction: 'PROPHETS', mySpecialBudgets: [{ specialAction: 'SEAL', remainingUsesThisEra: 1, remainingUsesThisGame: 2 }] },
      { mySpecialActions: ['SEAL'] },
    )
    const view = selectActionRoundView(state)
    if (view.kind !== 'open') throw new Error('expected open view')
    expect(view.specials[0]).toMatchObject({ remainingUsesThisEra: 1, remainingUsesThisGame: 2 })
  })

  it('excludes the caller from the opponent list', () => {
    const state = baseState(
      {},
      {
        players: [
          { playerId: 'me', playerName: 'Me', score: 1, isConnected: true, faction: null },
          { playerId: 'them', playerName: 'Them', score: 2, isConnected: true, faction: null },
        ],
      },
    )
    const view = selectActionRoundView(state, 'me')
    if (view.kind !== 'open') throw new Error('expected open view')
    expect(view.opponents).toEqual([{ playerId: 'them', playerName: 'Them', isConnected: true }])
  })

  it('keeps opponents without a playerName targetable under a seat label', () => {
    const state = baseState(
      {},
      {
        players: [
          { playerId: 'me', playerName: null, score: 1, isConnected: true, faction: null },
          { playerId: 'them', playerName: null, score: 2, isConnected: true, faction: null },
        ],
      },
    )
    const view = selectActionRoundView(state, 'me')
    if (view.kind !== 'open') throw new Error('expected open view')
    expect(view.opponents).toEqual([{ playerId: 'them', playerName: 'Player 2', isConnected: true }])
  })

  it('reflects hasSubmitted from an accepted ACTION submission for the current era/round', () => {
    const state = baseState({ mySubmissions: [{ eraNumber: 2, roundNumber: 2, kind: 'ACTION', actionType: 'CARD' }] })
    const view = selectActionRoundView(state)
    if (view.kind !== 'open') throw new Error('expected open view')
    expect(view.hasSubmitted).toBe(true)
  })
})
