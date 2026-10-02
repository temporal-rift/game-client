import { describe, expect, it } from 'vitest'
import {
  actionSelectionFor,
  coordinatesComplete,
  describeTargets,
  isEventChosen,
  isPlayerChosen,
  outcomeRole,
  pickDisguise,
  pickEvent,
  pickOutcome,
  pickPlayer,
  targetPrompt,
  targetsEvents,
  targetsPlayers,
  type OpenActionRoundView,
} from './actionTargeting'
import type { TargetMode } from './actionRules'

const events = [
  {
    eventId: 'evt-1',
    title: 'Reactor ignition',
    carryOverState: 'FRESH' as const,
    outcomes: [
      { outcomeId: 'out-1', description: 'Ignition succeeds' },
      { outcomeId: 'out-2', description: 'Ignition fails' },
    ],
  },
  { eventId: 'evt-2', title: 'Harbour vote', carryOverState: 'FRESH' as const, outcomes: [{ outcomeId: 'out-3', description: 'Passes' }] },
]
const opponents = [
  { playerId: 'p-bo', playerName: 'Bo', isConnected: true },
  { playerId: 'p-cy', playerName: 'Cy', isConnected: true },
]

describe('board target areas per mode', () => {
  it.each<[TargetMode, boolean, boolean]>([
    ['EVENT_OUTCOME', true, false],
    ['EVENT_OUTCOME_PAIR', true, false],
    ['EVENT_ONLY', true, false],
    ['EVENT_LIST', true, false],
    ['PLAYER', false, true],
    ['PLAYER_LIST', false, true],
    ['DISGUISE', false, false],
    ['NONE', false, false],
  ])('%s targets events=%s players=%s', (mode, events, players) => {
    expect(targetsEvents(mode)).toBe(events)
    expect(targetsPlayers(mode)).toBe(players)
  })

  it('offers outcomes only in outcome modes', () => {
    expect(outcomeRole('EVENT_OUTCOME', {}, 'evt-1')).toBe('outcome')
    expect(outcomeRole('EVENT_OUTCOME_PAIR', {}, 'evt-1')).toBe('source')
    expect(outcomeRole('EVENT_ONLY', {}, 'evt-1')).toBeNull()
    expect(outcomeRole('EVENT_LIST', {}, 'evt-1')).toBeNull()
  })
})

describe('single outcome', () => {
  it('chooses event and outcome together and is then complete', () => {
    const chosen = pickOutcome('EVENT_OUTCOME', {}, 'evt-1', 'out-2')
    expect(chosen).toEqual({ targetEventId: 'evt-1', targetOutcomeId: 'out-2' })
    expect(coordinatesComplete('EVENT_OUTCOME', chosen, 0)).toBe(true)
    expect(targetPrompt('EVENT_OUTCOME', chosen, 0)).toBeNull()
  })

  it('focuses an event without an outcome and stays incomplete', () => {
    const focused = pickEvent('EVENT_OUTCOME', { targetEventId: 'evt-2', targetOutcomeId: 'out-3' }, 'evt-1', 0)
    expect(focused).toEqual({ targetEventId: 'evt-1' })
    expect(coordinatesComplete('EVENT_OUTCOME', focused, 0)).toBe(false)
    expect(targetPrompt('EVENT_OUTCOME', focused, 0)).toMatch(/choose an outcome/i)
  })
})

describe('outcome pair', () => {
  it('chooses a source, then a different target on the same event', () => {
    const source = pickOutcome('EVENT_OUTCOME_PAIR', {}, 'evt-1', 'out-1')
    expect(source).toEqual({ targetEventId: 'evt-1', sourceOutcomeId: 'out-1' })
    expect(outcomeRole('EVENT_OUTCOME_PAIR', source, 'evt-1')).toBe('target')
    expect(outcomeRole('EVENT_OUTCOME_PAIR', source, 'evt-2')).toBe('source')
    expect(coordinatesComplete('EVENT_OUTCOME_PAIR', source, 0)).toBe(false)
    expect(targetPrompt('EVENT_OUTCOME_PAIR', source, 0)).toMatch(/shift toward/i)

    const pair = pickOutcome('EVENT_OUTCOME_PAIR', source, 'evt-1', 'out-2')
    expect(pair).toEqual({ targetEventId: 'evt-1', sourceOutcomeId: 'out-1', targetOutcomeId: 'out-2' })
    expect(coordinatesComplete('EVENT_OUTCOME_PAIR', pair, 0)).toBe(true)
  })

  it('ignores the source as its own target', () => {
    const source = { targetEventId: 'evt-1', sourceOutcomeId: 'out-1' }
    expect(pickOutcome('EVENT_OUTCOME_PAIR', source, 'evt-1', 'out-1')).toBe(source)
  })

  it('restarts the pair on another event', () => {
    const pair = { targetEventId: 'evt-1', sourceOutcomeId: 'out-1', targetOutcomeId: 'out-2' }
    expect(pickOutcome('EVENT_OUTCOME_PAIR', pair, 'evt-2', 'out-3')).toEqual({ targetEventId: 'evt-2', sourceOutcomeId: 'out-3' })
  })

  it('resets the pair when its event is picked again', () => {
    const pair = { targetEventId: 'evt-1', sourceOutcomeId: 'out-1', targetOutcomeId: 'out-2' }
    expect(pickEvent('EVENT_OUTCOME_PAIR', pair, 'evt-1', 0)).toEqual({ targetEventId: 'evt-1' })
  })
})

describe('event and event list', () => {
  it('chooses a single event', () => {
    const chosen = pickEvent('EVENT_ONLY', {}, 'evt-2', 0)
    expect(isEventChosen('EVENT_ONLY', chosen, 'evt-2')).toBe(true)
    expect(coordinatesComplete('EVENT_ONLY', chosen, 0)).toBe(true)
  })

  it('toggles distinct events up to the grade count', () => {
    let chosen = pickEvent('EVENT_LIST', {}, 'evt-1', 2)
    expect(targetPrompt('EVENT_LIST', chosen, 2)).toBe('Choose 2 events (1/2 chosen).')
    chosen = pickEvent('EVENT_LIST', chosen, 'evt-2', 2)
    expect(coordinatesComplete('EVENT_LIST', chosen, 2)).toBe(true)
    expect(pickEvent('EVENT_LIST', chosen, 'evt-3', 2)).toEqual({ targetEventIds: ['evt-1', 'evt-2'] })
    chosen = pickEvent('EVENT_LIST', chosen, 'evt-1', 2)
    expect(chosen).toEqual({ targetEventIds: ['evt-2'] })
    expect(isEventChosen('EVENT_LIST', chosen, 'evt-1')).toBe(false)
  })
})

describe('player and player list', () => {
  it('chooses one opponent', () => {
    const chosen = pickPlayer('PLAYER', { targetPlayerId: 'p-bo' }, 'p-cy', 0)
    expect(chosen).toEqual({ targetPlayerId: 'p-cy' })
    expect(isPlayerChosen('PLAYER', chosen, 'p-cy')).toBe(true)
    expect(coordinatesComplete('PLAYER', chosen, 0)).toBe(true)
  })

  it('toggles distinct opponents up to the grade count', () => {
    const one = pickPlayer('PLAYER_LIST', {}, 'p-bo', 2)
    expect(coordinatesComplete('PLAYER_LIST', one, 2)).toBe(false)
    const two = pickPlayer('PLAYER_LIST', one, 'p-cy', 2)
    expect(isPlayerChosen('PLAYER_LIST', two, 'p-cy')).toBe(true)
    expect(coordinatesComplete('PLAYER_LIST', two, 2)).toBe(true)
  })
})

describe('disguise and no target', () => {
  it('completes a disguise only with a category', () => {
    expect(coordinatesComplete('DISGUISE', {}, 0)).toBe(false)
    expect(coordinatesComplete('DISGUISE', pickDisguise('INFORMATION'), 0)).toBe(true)
  })

  it('needs nothing for a no-target choice', () => {
    expect(coordinatesComplete('NONE', {}, 0)).toBe(true)
    expect(targetPrompt('NONE', {}, 0)).toBeNull()
  })
})

describe('describeTargets', () => {
  it('names a single outcome target by event title and outcome description', () => {
    expect(describeTargets({ targetEventId: 'evt-1', targetOutcomeId: 'out-1' }, { events, opponents })).toEqual([
      'Event: Reactor ignition',
      'Outcome: Ignition succeeds',
    ])
  })

  it('names both ends of a pair', () => {
    expect(describeTargets({ targetEventId: 'evt-1', sourceOutcomeId: 'out-1', targetOutcomeId: 'out-2' }, { events, opponents })).toEqual([
      'Event: Reactor ignition',
      'From: Ignition succeeds',
      'To: Ignition fails',
    ])
  })

  it('names event lists, players and disguises', () => {
    expect(describeTargets({ targetEventIds: ['evt-1', 'evt-2'] }, { events, opponents })).toEqual(['Event: Reactor ignition', 'Event: Harbour vote'])
    expect(describeTargets({ targetPlayerIds: ['p-bo', 'p-cy'] }, { events, opponents })).toEqual(['Player: Bo', 'Player: Cy'])
    expect(describeTargets({ disguiseCategory: 'DISRUPTION' }, { events, opponents })).toEqual(['Disguise: Disruption'])
  })
})

describe('actionSelectionFor', () => {
  const view: OpenActionRoundView = {
    kind: 'open',
    gameId: 'game-1',
    eraNumber: 1,
    roundNumber: 2,
    hasSubmitted: false,
    acceptedDecision: null,
    submittedCount: 0,
    totalPlayers: 3,
    deadline: null,
    hand: [
      { cardInstanceId: 'card-scan', cardType: 'SCAN', grade: 'II', name: 'Scan', effectSummary: '', targetMode: 'EVENT_LIST', targetListSize: 2, isPlayableThisRound: true },
    ],
    specials: [
      { specialAction: 'OBSCURE', name: 'Obscure', effectSummary: '', targetMode: 'NONE', available: true, unavailableReason: null, remainingUsesThisEra: null, remainingUsesThisGame: null },
    ],
    activeEvents: events,
    opponents,
  }

  it('resolves a card with its list size and completeness', () => {
    const selection = actionSelectionFor(view, { kind: 'card', cardInstanceId: 'card-scan', coordinates: { targetEventIds: ['evt-1'] } })
    expect(selection).toMatchObject({ targetMode: 'EVENT_LIST', listSize: 2, isComplete: false })
    expect(selection.choice).toMatchObject({ kind: 'card', card: { name: 'Scan' } })
  })

  it('treats a no-target special and a pass as complete', () => {
    expect(actionSelectionFor(view, { kind: 'special', specialAction: 'OBSCURE', coordinates: {} })).toMatchObject({ targetMode: 'NONE', isComplete: true })
    expect(actionSelectionFor(view, { kind: 'pass' })).toMatchObject({ choice: { kind: 'pass' }, targetMode: null, isComplete: true })
  })

  it('resolves nothing for no draft or a card no longer in the hand', () => {
    expect(actionSelectionFor(view, { kind: 'none' }).choice).toBeNull()
    expect(actionSelectionFor(view, { kind: 'card', cardInstanceId: 'gone', coordinates: {} })).toMatchObject({ choice: null, isComplete: false })
  })
})
