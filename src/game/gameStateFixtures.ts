/**
 * Shared `GameStateView` builder for feature-module selector tests
 * (`actionView.test.ts`, `knowledgeView.test.ts`, ...). Not used by app code.
 * Selectors trust the contract-validated shape, so fixtures only need to be
 * well-typed; readable ids keep expectations legible.
 */

import type { GameStateView } from '../api/projection'

/** `overrides` sets envelope fields, `slices` the feature slices a test is about; both are typed. */
export function baseGameState(overrides: Partial<GameStateView> = {}, slices: Partial<GameStateView> = {}): GameStateView {
  return {
    gameId: 'game-1',
    eraNumber: 2,
    revision: 5,
    phase: 'ACTION_ROUND_2',
    roundNumber: 2,
    myFaction: 'ERASERS',
    myScore: 4,
    winScoreThreshold: 20,
    myHand: [],
    myRevealedIntel: [],
    activeEvents: [],
    players: [],
    deadlines: { handSelectionExpiresAt: null, actionRoundExpiresAt: null, paradoxResolutionExpiresAt: null },
    phaseContext: { declarationOpen: false, paradoxOpen: false },
    mySubmissions: [],
    mySpecialBudgets: [],
    ...slices,
    ...overrides,
  }
}
