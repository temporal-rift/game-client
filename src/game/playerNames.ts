/**
 * Participant-name resolution shared by every feature slice: builds a
 * player-id lookup from the entitled roster and falls back to a stable
 * short-id label for unknown ids instead of omitting the entry.
 */

import type { GameStateView } from '../api/projection'

export function playerNameLookup(state: GameStateView): ReadonlyMap<string, string> {
  const lookup = new Map<string, string>()
  for (const { playerId, playerName } of state.players) {
    if (playerName) {
      lookup.set(playerId, playerName)
    }
  }
  return lookup
}

export function nameFor(playerId: string, lookup: ReadonlyMap<string, string>): string {
  return lookup.get(playerId) ?? `Player ${playerId.slice(0, 8)}`
}
