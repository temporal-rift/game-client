import { describe, expect, it } from 'vitest'
import type { GameStateView } from '../api/projection'
import { baseGameState } from './gameStateFixtures'
import { backoffDelayMs, hasAcceptedSubmission, shouldApplyGameState } from './reconciliation'

function gameState(overrides: Partial<GameStateView> = {}): GameStateView {
  return baseGameState({ eraNumber: 1, revision: 1, phase: 'ACTION_ROUND_1', roundNumber: 1, ...overrides })
}

describe('shouldApplyGameState', () => {
  it('applies the first response even without a confirmed revision', () => {
    expect(shouldApplyGameState(null, gameState({ revision: undefined }))).toBe(true)
  })

  it('never lets an unconfirmed response replace an already-reconciled view', () => {
    const current = gameState({ revision: 5 })
    expect(shouldApplyGameState(current, gameState({ revision: undefined }))).toBe(false)
  })

  it('upgrades an unconfirmed view once a revision is confirmed', () => {
    const current = gameState({ revision: undefined })
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

describe('backoffDelayMs', () => {
  const options = { baseDelayMs: 1000, maxDelayMs: 8000 }

  it('uses the base delay while polls succeed', () => {
    expect(backoffDelayMs(0, options)).toBe(1000)
  })

  it('doubles the delay for every consecutive failure', () => {
    expect(backoffDelayMs(1, options)).toBe(2000)
    expect(backoffDelayMs(2, options)).toBe(4000)
  })

  it('caps the delay at the configured maximum', () => {
    expect(backoffDelayMs(3, options)).toBe(8000)
    expect(backoffDelayMs(10, options)).toBe(8000)
  })
})

describe('hasAcceptedSubmission', () => {
  it('reports false when there is no state yet', () => {
    expect(hasAcceptedSubmission(null, { eraNumber: 1, kind: 'HAND_SELECTION' })).toBe(false)
  })

  it('finds an accepted hand selection by era and kind alone', () => {
    const state = gameState({
      mySubmissions: [{ eraNumber: 1, roundNumber: null, kind: 'HAND_SELECTION', status: 'ACCEPTED' }],
    })
    expect(hasAcceptedSubmission(state, { eraNumber: 1, kind: 'HAND_SELECTION' })).toBe(true)
    expect(hasAcceptedSubmission(state, { eraNumber: 2, kind: 'HAND_SELECTION' })).toBe(false)
  })

  it('scopes an ordinary action submission to its round', () => {
    const state = gameState({
      mySubmissions: [{ eraNumber: 1, roundNumber: 2, kind: 'ACTION', status: 'ACCEPTED', actionType: 'CARD' }],
    })
    expect(hasAcceptedSubmission(state, { eraNumber: 1, kind: 'ACTION', roundNumber: 2 })).toBe(true)
    expect(hasAcceptedSubmission(state, { eraNumber: 1, kind: 'ACTION', roundNumber: 1 })).toBe(false)
  })

  it('never matches another kind at the same coordinate', () => {
    const state = gameState({
      mySubmissions: [{ eraNumber: 1, roundNumber: null, kind: 'DECLARATION', status: 'ACCEPTED' }],
    })
    expect(hasAcceptedSubmission(state, { eraNumber: 1, kind: 'PARADOX_CARD' })).toBe(false)
  })
})
