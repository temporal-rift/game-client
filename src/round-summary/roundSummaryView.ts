/**
 * Builds the public round-summary display view from authoritative game state.
 * `raw` carries `lastRoundSummary`/`players` unparsed (the shared game-state
 * client only validates the reconciliation envelope), so this module parses
 * its own slice — mirroring how `actionView.ts` and `knowledgeView.ts` read
 * their own `raw` fields.
 *
 * The summary deliberately reveals only an action's typed category and
 * family, never a card type, grade, special name, faction, or target. A
 * Decoy entry arrives already disguised (family `CARD` with its declared
 * category) and is indistinguishable from a real card of that category.
 */

import { cardCategoryDisplayName } from '../action/actionRules'
import type { CardCategory } from '../api/actionClient'
import type { GameStateView } from '../api/gameStateClient'
import { stringField } from '../api/httpJson'

export type ActionFamily = 'CARD' | 'SPECIAL'

export type RoundSummaryEntry =
  | {
      readonly kind: 'card'
      readonly playerId: string
      readonly playerName: string
      readonly actionFamily: ActionFamily
      readonly familyLabel: string
      readonly actionCategory: CardCategory
      readonly categoryLabel: string
    }
  | {
      readonly kind: 'special'
      readonly playerId: string
      readonly playerName: string
    }
  | {
      readonly kind: 'skipped'
      readonly playerId: string
      readonly playerName: string
    }

export type RoundSummaryView =
  | { readonly kind: 'unavailable'; readonly reason: string }
  | {
      readonly kind: 'ready'
      readonly gameId: string
      readonly eraNumber: number
      readonly roundNumber: number
      readonly entries: readonly RoundSummaryEntry[]
    }

const KNOWN_CATEGORIES: ReadonlySet<string> = new Set(['PROBABILITY_SHIFTER', 'INFORMATION', 'DISRUPTION', 'PARADOX'])
const KNOWN_FAMILIES: ReadonlySet<string> = new Set(['CARD', 'SPECIAL'])

function parseCategory(value: unknown): CardCategory | null {
  return typeof value === 'string' && KNOWN_CATEGORIES.has(value) ? (value as CardCategory) : null
}

function parseFamily(value: unknown): ActionFamily | null {
  return typeof value === 'string' && KNOWN_FAMILIES.has(value) ? (value as ActionFamily) : null
}

function playerNameLookup(raw: Record<string, unknown>): ReadonlyMap<string, string> {
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

function nameFor(playerId: string, lookup: ReadonlyMap<string, string>): string {
  return lookup.get(playerId) ?? `Player ${playerId.slice(0, 8)}`
}

function parseEntry(value: unknown, playerLookup: ReadonlyMap<string, string>): RoundSummaryEntry | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const source = value as Record<string, unknown>
  const playerId = stringField(source['playerId'])
  if (!playerId) {
    return null
  }
  const playerName = nameFor(playerId, playerLookup)
  if (source['skipped'] === true) {
    return { kind: 'skipped', playerId, playerName }
  }
  if (source['skipped'] !== false) {
    return null
  }
  const family = parseFamily(source['actionFamily'])
  if (family === 'SPECIAL') {
    if (source['actionCategory'] !== null && source['actionCategory'] !== undefined) {
      return null
    }
    return { kind: 'special', playerId, playerName }
  }
  if (family === 'CARD') {
    const category = parseCategory(source['actionCategory'])
    if (!category) {
      return null
    }
    return {
      kind: 'card',
      playerId,
      playerName,
      actionFamily: family,
      familyLabel: 'Card',
      actionCategory: category,
      categoryLabel: cardCategoryDisplayName(category),
    }
  }
  return null
}

/**
 * Selects the public round-summary view for the current participant. The
 * most recently completed round's summary is identical for every
 * participant; before the first round closes there is no summary to show.
 */
export function selectRoundSummaryView(state: GameStateView | null): RoundSummaryView {
  if (!state) {
    return { kind: 'unavailable', reason: 'Game state is not loaded yet.' }
  }
  const raw = state.raw
  const summary = raw['lastRoundSummary']
  if (summary === null || summary === undefined) {
    return { kind: 'unavailable', reason: 'No round has closed yet.' }
  }
  if (typeof summary !== 'object' || Array.isArray(summary)) {
    return { kind: 'unavailable', reason: 'No round has closed yet.' }
  }
  const source = summary as Record<string, unknown>
  const roundNumber = typeof source['roundNumber'] === 'number' ? source['roundNumber'] : null
  const actionSummaries = source['actionSummaries']
  if (roundNumber === null || !Array.isArray(actionSummaries)) {
    return { kind: 'unavailable', reason: 'No round has closed yet.' }
  }
  const playerLookup = playerNameLookup(raw)
  const entries = actionSummaries.flatMap((entry) => {
    const parsed = parseEntry(entry, playerLookup)
    return parsed ? [parsed] : []
  })
  return { kind: 'ready', gameId: state.gameId, eraNumber: state.eraNumber, roundNumber, entries }
}
