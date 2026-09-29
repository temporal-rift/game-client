/**
 * Builds the public round-summary display view from authoritative game state.
 *
 * The summary deliberately reveals only an action's typed category and
 * family, never a card type, grade, special name, faction, or target. A
 * Decoy entry arrives already disguised (family `CARD` with its declared
 * category) and is indistinguishable from a real card of that category.
 */

import { cardCategoryDisplayName } from '../action/actionRules'
import type { CardCategory } from '../api/action'
import type { ActionFamily, ActionSummary, GameStateView } from '../api/projection'
import { nameFor, playerNameLookup } from '../game/playerNames'

export type { ActionFamily }

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

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined
}

/**
 * The contract types each field; these rules keep an entry consistent with
 * what its family may reveal. An entry that breaks them is left out rather
 * than shown with more (or less) than its family allows.
 */
function summaryEntry(summary: ActionSummary, playerLookup: ReadonlyMap<string, string>): RoundSummaryEntry | null {
  const { playerId, skipped, actionFamily, actionCategory } = summary
  const playerName = nameFor(playerId, playerLookup)
  if (skipped) {
    return isPresent(actionFamily) || isPresent(actionCategory) ? null : { kind: 'skipped', playerId, playerName }
  }
  if (actionFamily === 'SPECIAL') {
    return isPresent(actionCategory) ? null : { kind: 'special', playerId, playerName }
  }
  if (actionFamily === 'CARD' && actionCategory) {
    return {
      kind: 'card',
      playerId,
      playerName,
      actionFamily: 'CARD',
      familyLabel: 'Card',
      actionCategory,
      categoryLabel: cardCategoryDisplayName(actionCategory),
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
  const summary = state.lastRoundSummary
  if (!summary) {
    return { kind: 'unavailable', reason: 'No round has closed yet.' }
  }
  const playerLookup = playerNameLookup(state)
  const entries = summary.actionSummaries.flatMap((entry) => {
    const parsed = summaryEntry(entry, playerLookup)
    return parsed ? [parsed] : []
  })
  return { kind: 'ready', gameId: state.gameId, eraNumber: state.eraNumber, roundNumber: summary.roundNumber, entries }
}
