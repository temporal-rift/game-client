import { describe, expect, it } from 'vitest'
import type { GameStateView } from '../api/projection'
import { baseGameState } from '../game/gameStateFixtures'
import { sevenCardDeal } from '../test/gameStatePayload'
import { selectHandSelectionView } from './handSelectionView'

function stateBody(overrides: Partial<GameStateView> = {}): GameStateView {
  return baseGameState({
    revision: 1,
    phase: 'HAND_SELECTION',
    roundNumber: null,
    pendingHandSelection: {
      cards: sevenCardDeal((slot) => ({ cardInstanceId: `card-${slot}`, cardType: 'PUSH', grade: 'II', dealSlot: slot })),
      requiredSelectionCount: 5,
      expiresAt: '2026-10-01T12:00:00Z',
    },
    ...overrides,
  })
}

describe('selectHandSelectionView', () => {
  it('exposes only the caller private seven-card offer in deal order', () => {
    const state = stateBody({
      pendingHandSelection: {
        cards: sevenCardDeal((slot) => ({ cardInstanceId: `card-${8 - slot}`, cardType: 'PUSH', grade: 'II', dealSlot: 8 - slot })),
        requiredSelectionCount: 5,
        expiresAt: '2026-10-01T12:00:00Z',
      },
    })

    expect(selectHandSelectionView(state)).toMatchObject({
      kind: 'open',
      gameId: 'game-1',
      eraNumber: 2,
      requiredSelectionCount: 5,
      expiresAt: '2026-10-01T12:00:00Z',
    })
    const view = selectHandSelectionView(state)
    if (view.kind === 'open') expect(view.cards.map((card) => card.cardInstanceId)).toEqual(['card-1', 'card-2', 'card-3', 'card-4', 'card-5', 'card-6', 'card-7'])
  })

  it('does not fabricate an offer when the authoritative pending deal repeats a card', () => {
    const cards = sevenCardDeal((slot) => ({ cardInstanceId: slot === 7 ? 'card-1' : `card-${slot}`, cardType: 'PUSH', grade: 'II', dealSlot: slot }))
    const state = stateBody({ pendingHandSelection: { cards, requiredSelectionCount: 5, expiresAt: '2026-10-01T12:00:00Z' } })
    expect(selectHandSelectionView(state)).toEqual({ kind: 'unavailable', reason: 'Your private card offer is incomplete. Refreshing authoritative state.' })
  })

  it('replaces the local offer with the server-accepted five-card hand after recovery', () => {
    const state = stateBody({
      mySubmissions: [{ eraNumber: 2, roundNumber: null, window: 'HAND_SELECTION', status: 'ACCEPTED' }],
      myHand: Array.from({ length: 5 }, (_, index) => ({ cardInstanceId: `kept-${index + 1}`, cardType: 'SCAN', grade: 'I', isPlayableThisRound: true })),
    })
    const view = selectHandSelectionView(state)
    expect(view.kind).toBe('accepted')
    if (view.kind === 'accepted') expect(view.cards.map((card) => card.cardInstanceId)).toEqual(['kept-1', 'kept-2', 'kept-3', 'kept-4', 'kept-5'])
  })

  it('fails closed while an accepted hand is not yet available', () => {
    const state = stateBody({ mySubmissions: [{ eraNumber: 2, roundNumber: null, window: 'HAND_SELECTION', status: 'ACCEPTED' }] })
    expect(selectHandSelectionView(state)).toEqual({ kind: 'unavailable', reason: 'Your accepted hand is being refreshed.' })
  })
})
