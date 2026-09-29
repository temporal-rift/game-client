import type { GameStateView } from '../api/projection'
import { uuid } from './uuid'

/**
 * A contract-valid `GET /games/{gameId}/state` body for tests that go
 * through the network layer, where every response is validated against the
 * pinned projection contract.
 */
export function gameStatePayload(overrides: Partial<GameStateView> = {}): GameStateView {
  return {
    gameId: uuid('game-1'),
    eraNumber: 2,
    phase: 'ACTION_ROUND_2',
    myScore: 3,
    myHand: [],
    myRevealedIntel: [],
    activeEvents: [],
    players: [],
    ...overrides,
  }
}

type DealtCard = NonNullable<GameStateView['pendingHandSelection']>['cards'][number]

/** A seven-card pending deal, as the contract's fixed-length tuple. */
export function sevenCardDeal(card: (slot: number) => DealtCard): NonNullable<GameStateView['pendingHandSelection']>['cards'] {
  const [first, second, third, fourth, fifth, sixth, seventh] = [1, 2, 3, 4, 5, 6, 7].map((slot) => card(slot))
  return [first, second, third, fourth, fifth, sixth, seventh]
}
