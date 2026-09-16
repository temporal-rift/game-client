import type { PlayerView } from '../types/playerView'

/**
 * Player-safe sample state for rendering the shell before authenticated
 * gameplay contracts are integrated. Never sourced from or written back to
 * a real game; render code must not treat this as authoritative.
 */
export const sampleFixturePlayerView: PlayerView = {
  gameId: 'fixture-game',
  gameLabel: 'Game 024',
  currentEra: 2,
  currentRound: 3,
  roundsPerEra: 3,
  phaseLabel: 'Decision window',
  phaseDeadlineLabel: '00:43',
  publicBandAgeLabel: 'Bands from round 2',
  players: [
    { id: 'player-you', displayName: 'You', score: 8, isCurrentPlayer: true },
    { id: 'player-nora', displayName: 'Nora', score: 6, isCurrentPlayer: false },
    { id: 'player-eli', displayName: 'Eli', score: 5, isCurrentPlayer: false },
  ],
  events: [
    {
      id: 'evt-1',
      era: 2,
      title: 'The Assassination Attempt on the Peace Delegate',
      artwork: 'delegate',
      status: 'in-progress',
      outcomes: [
        { id: 'evt-1-survives', label: 'Delegate survives', publicBand: 'medium', isValidTarget: true },
        { id: 'evt-1-collapse', label: 'Negotiations collapse', publicBand: 'low', isValidTarget: true },
        { id: 'evt-1-martyr', label: 'Attacker becomes a martyr', publicBand: 'medium', isValidTarget: true },
      ],
    },
    {
      id: 'evt-2',
      era: 2,
      title: "The Quantum Reactor's First Ignition",
      artwork: 'reactor',
      status: 'in-progress',
      outcomes: [
        { id: 'evt-2-success', label: 'Ignition succeeds', publicBand: 'medium', isValidTarget: true },
        { id: 'evt-2-destroyed', label: 'Facility is destroyed', publicBand: 'low', isValidTarget: true },
        { id: 'evt-2-anomaly', label: 'Temporal anomaly', publicBand: 'high', isValidTarget: true },
      ],
    },
    {
      id: 'evt-3',
      era: 2,
      title: 'The Collapse of the Northern Trade Pact',
      artwork: 'pact',
      status: 'in-progress',
      outcomes: [
        { id: 'evt-3-renegotiation', label: 'Emergency renegotiation', publicBand: 'low', isValidTarget: true },
        { id: 'evt-3-rivals', label: 'Rival factions fill the vacuum', publicBand: 'medium', isValidTarget: true },
        { id: 'evt-3-splinter', label: 'A splinter agreement forms', publicBand: 'medium', isValidTarget: true },
      ],
    },
  ],
  hand: [
    { id: 'card-push', name: 'Push', grade: 2, description: 'Shift an outcome by +20.', kind: 'push', isAvailable: true },
    {
      id: 'card-suppress',
      name: 'Suppress',
      grade: 1,
      description: 'Shift an outcome by -10.',
      kind: 'suppress',
      isAvailable: true,
    },
    {
      id: 'card-scan',
      name: 'Scan',
      grade: 2,
      description: 'Earn exact probability intel.',
      kind: 'scan',
      isAvailable: false,
      unavailableReason: 'Unavailable this round',
    },
    {
      id: 'card-nullify',
      name: 'Nullify',
      grade: 1,
      description: 'Cancel an eligible opponent card.',
      kind: 'nullify',
      isAvailable: true,
    },
    {
      id: 'card-collide',
      name: 'Collide',
      grade: 1,
      description: 'Bring two outcome weights together.',
      kind: 'collide',
      isAvailable: true,
    },
  ],
  faction: {
    factionName: 'Prophets',
    description: 'Preserve the written future.',
    score: 8,
    scoreThreshold: 20,
    specialName: 'Foresight',
    specialRemainingUses: 2,
    factionsInGame: ['Prophets', 'Erasers', 'Weavers'],
    knowledge: [
      {
        id: 'know-1',
        label: 'Written outcome',
        detail: 'Reactor ignition succeeds',
        scope: 'private',
        ageLabel: 'Current era',
      },
      {
        id: 'know-2',
        label: 'Public observation',
        detail: 'Outcome bands from the previous round',
        scope: 'public',
        ageLabel: 'Round 2',
      },
    ],
  },
  roundStatus: { submittedPlayers: 1, totalPlayers: 3, hasSubmitted: false },
  pendingAction: { cardId: 'card-push', targetId: 'evt-2-success', confirmLabel: 'Confirm action' },
}
