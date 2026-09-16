import type { PlayerView } from '../types/playerView'

/**
 * Player-safe sample state for rendering the shell before authenticated
 * gameplay contracts are integrated. Never sourced from or written back to
 * a real game; render code must not treat this as authoritative.
 */
export const sampleFixturePlayerView: PlayerView = {
  gameId: 'fixture-game',
  currentEra: 1,
  currentRound: 2,
  events: [
    { id: 'evt-1', era: 1, title: 'The Signal Fractures', publicBand: '30 / 45 / 25', status: 'resolved' },
    { id: 'evt-2', era: 1, title: 'Convergence at the Vault', publicBand: '40 / 40 / 20', status: 'in-progress' },
    { id: 'evt-3', era: 1, title: 'The Last Delegation', publicBand: 'unknown', status: 'upcoming' },
  ],
  hand: [
    { id: 'card-1', name: 'Anchor Point', grade: 3, description: 'Stabilize an outcome toward the current band.' },
    { id: 'card-2', name: 'Split the Thread', grade: 2, description: 'Nudge weight from one outcome to another.' },
  ],
  faction: {
    factionName: 'Chronoclast',
    specialName: 'Seal',
    specialRemainingUses: 2,
    knowledge: [
      { id: 'know-1', label: 'Vault outcome trend', detail: 'Leans toward the middle branch this era.', scope: 'private' },
      { id: 'know-2', label: 'Public band', detail: '40 / 40 / 20', scope: 'public' },
    ],
  },
  pendingAction: {
    id: 'action-1',
    summary: 'Play Anchor Point',
    targetLabel: 'Convergence at the Vault',
    confirmLabel: 'Confirm action',
  },
}
