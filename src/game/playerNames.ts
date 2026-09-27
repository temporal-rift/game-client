/**
 * Participant-name resolution shared by every feature slice that parses its
 * own `raw` game-state fields: builds a player-id lookup from the entitled
 * roster and falls back to a stable short-id label for unknown ids instead
 * of omitting the entry.
 */

import { stringField } from '../api/httpJson'

export function playerNameLookup(raw: Record<string, unknown>): ReadonlyMap<string, string> {
  const lookup = new Map<string, string>()
  const value = raw['players']
  if (!Array.isArray(value)) {
    return lookup
  }
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const playerId = stringField(source['playerId'])
    const playerName = stringField(source['playerName'])
    if (playerId && playerName) {
      lookup.set(playerId, playerName)
    }
  }
  return lookup
}

export function nameFor(playerId: string, lookup: ReadonlyMap<string, string>): string {
  return lookup.get(playerId) ?? `Player ${playerId.slice(0, 8)}`
}
