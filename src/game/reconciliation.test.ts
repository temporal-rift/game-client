import { describe, expect, it } from 'vitest'
import type { GameStateView } from '../api/gameStateClient'
import { hasAcceptedSubmission, nextPollDelayMs, shouldApplyGameState } from './reconciliation'

function gameState(overrides: Partial<GameStateView> = {}): GameStateView {
  return {
    gameId: 'game-1',
    eraNumber: 1,
    revision: 1,
    lastUpdatedAt: '2026-01-01T00:00:00Z',
    phase: 'ACTION_ROUND_1',
    roundNumber: 1,
    myFaction: null,
    myScore: 0,
    deadlines: { handSelectionExpiresAt: null, actionRoundExpiresAt: null, paradoxResolutionExpiresAt: null },
    phaseContext: { declarationOpen: false, paradoxOpen: false, paradoxIds: [] },
    mySubmissions: [],
    mySpecialBudgets: [],
    result: null,
    raw: {},
    ...overrides,
  }
}

describe('shouldApplyGameState', () => {
  it('applies the first response even without a confirmed revision', () => {
    expect(shouldApplyGameState(null, gameState({ revision: null }))).toBe(true)
  })

  it('never lets an unconfirmed response replace an already-reconciled view', () => {
    const current = gameState({ revision: 5 })
    expect(shouldApplyGameState(current, gameState({ revision: null }))).toBe(false)
  })

  it('upgrades an unconfirmed view once a revision is confirmed', () => {
    const current = gameState({ revision: null })
    expect(shouldApplyGameState(current, gameState({ revision: 1 }))).toBe(true)
  })

  it('applies a strictly newer revision', () => {
    const current = gameState({ revision: 5 })
    expect(shouldApplyGameState(current, gameState({ revision: 6 }))).toBe(true)
  })

  it('rejects a delayed response with an equal or lower revision', () => {
    const current = gameState({ revision: 6 })
    expect(shouldApplyGameState(current, gameState({ revision: 6 }))).toBe(false)
    expect(shouldApplyGameState(current, gameState({ revision: 5 }))).toBe(false)
  })
})

describe('nextPollDelayMs', () => {
  const options = { baseDelayMs: 1000, maxDelayMs: 8000 }

  it('resets to the base delay on success', () => {
    expect(nextPollDelayMs(4000, 'success', options)).toBe(1000)
  })

  it('doubles the delay on failure', () => {
    expect(nextPollDelayMs(1000, 'failure', options)).toBe(2000)
    expect(nextPollDelayMs(2000, 'failure', options)).toBe(4000)
  })

  it('caps the delay at the configured maximum', () => {
    expect(nextPollDelayMs(6000, 'failure', options)).toBe(8000)
    expect(nextPollDelayMs(8000, 'failure', options)).toBe(8000)
  })
})

describe('hasAcceptedSubmission', () => {
  it('reports false when there is no state yet', () => {
    expect(hasAcceptedSubmission(null, { eraNumber: 1, kind: 'HAND_SELECTION' })).toBe(false)
  })

  it('finds an accepted hand selection by era and kind alone', () => {
    const state = gameState({
      mySubmissions: [{ eraNumber: 1, roundNumber: null, kind: 'HAND_SELECTION', actionType: null }],
    })
    expect(hasAcceptedSubmission(state, { eraNumber: 1, kind: 'HAND_SELECTION' })).toBe(true)
    expect(hasAcceptedSubmission(state, { eraNumber: 2, kind: 'HAND_SELECTION' })).toBe(false)
  })

  it('scopes an ordinary action submission to its round', () => {
    const state = gameState({
      mySubmissions: [{ eraNumber: 1, roundNumber: 2, kind: 'ACTION', actionType: 'CARD' }],
    })
    expect(hasAcceptedSubmission(state, { eraNumber: 1, kind: 'ACTION', roundNumber: 2 })).toBe(true)
    expect(hasAcceptedSubmission(state, { eraNumber: 1, kind: 'ACTION', roundNumber: 1 })).toBe(false)
  })

  it('never matches another kind at the same coordinate', () => {
    const state = gameState({
      mySubmissions: [{ eraNumber: 1, roundNumber: null, kind: 'DECLARATION', actionType: null }],
    })
    expect(hasAcceptedSubmission(state, { eraNumber: 1, kind: 'PARADOX_CARD' })).toBe(false)
  })
})
