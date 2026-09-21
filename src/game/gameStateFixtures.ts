/**
 * Shared `GameStateView` builder for feature-module selector tests
 * (`actionView.test.ts`, `knowledgeView.test.ts`, ...). Not used by app code.
 */

import type { GameStateView } from '../api/gameStateClient'

export function baseGameState(overrides: Partial<GameStateView> = {}, raw: Record<string, unknown> = {}): GameStateView {
  return {
    gameId: 'game-1',
    eraNumber: 2,
    revision: 5,
    lastUpdatedAt: null,
    phase: 'ACTION_ROUND_2',
    roundNumber: 2,
    myFaction: 'ERASERS',
    myScore: 4,
    deadlines: { handSelectionExpiresAt: null, actionRoundExpiresAt: null, paradoxResolutionExpiresAt: null },
    phaseContext: { declarationOpen: false, paradoxOpen: false, paradoxIds: [] },
    mySubmissions: [],
    mySpecialBudgets: [],
    result: null,
    raw,
    ...overrides,
  }
}
