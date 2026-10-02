/**
 * Board targeting for one selected card or special: which board targets its
 * mode accepts, how a click on an event, outcome, player or disguise changes
 * the chosen coordinates, when they are complete, and how they read in the
 * confirmation summary. Only targets already present in the caller's game
 * state are offered; the server still validates every submission.
 */

import type { ActionCoordinates, CardCategory } from '../api/action'
import type { ActionRoundView, ActiveEventOption, HandCardOption, OpponentOption, SpecialActionOption } from './actionView'
import type { ActionDraft } from './useActionSubmission'
import { CARD_CATEGORIES, cardCategoryDisplayName, type TargetMode } from './actionRules'

export type OpenActionRoundView = Extract<ActionRoundView, { kind: 'open' }>

/** What picking an outcome chooses: the single target, or one end of a source/target pair. */
export type OutcomeRole = 'outcome' | 'source' | 'target'

export function targetsEvents(mode: TargetMode): boolean {
  return mode === 'EVENT_OUTCOME' || mode === 'EVENT_OUTCOME_PAIR' || mode === 'EVENT_ONLY' || mode === 'EVENT_LIST'
}

export function targetsPlayers(mode: TargetMode): boolean {
  return mode === 'PLAYER' || mode === 'PLAYER_LIST'
}

/** Null when outcomes on `eventId` are not targets in this mode. */
export function outcomeRole(mode: TargetMode, coordinates: ActionCoordinates, eventId: string): OutcomeRole | null {
  if (mode === 'EVENT_OUTCOME') return 'outcome'
  if (mode !== 'EVENT_OUTCOME_PAIR') return null
  return coordinates.targetEventId === eventId && coordinates.sourceOutcomeId ? 'target' : 'source'
}

export function isEventChosen(mode: TargetMode, coordinates: ActionCoordinates, eventId: string): boolean {
  return mode === 'EVENT_LIST' ? (coordinates.targetEventIds ?? []).includes(eventId) : coordinates.targetEventId === eventId
}

export function isPlayerChosen(mode: TargetMode, coordinates: ActionCoordinates, playerId: string): boolean {
  return mode === 'PLAYER_LIST' ? (coordinates.targetPlayerIds ?? []).includes(playerId) : coordinates.targetPlayerId === playerId
}

function toggled(current: readonly string[], id: string, limit: number): string[] {
  if (current.includes(id)) return current.filter((entry) => entry !== id)
  return current.length < limit ? [...current, id] : [...current]
}

/** In outcome modes picking an event focuses it and clears its outcomes; in list mode it toggles membership. */
export function pickEvent(mode: TargetMode, coordinates: ActionCoordinates, eventId: string, listSize: number): ActionCoordinates {
  if (mode === 'EVENT_LIST') return { targetEventIds: toggled(coordinates.targetEventIds ?? [], eventId, listSize) }
  return { targetEventId: eventId }
}

/** A pair starts with its source; an outcome on another event restarts the pair there. */
export function pickOutcome(mode: TargetMode, coordinates: ActionCoordinates, eventId: string, outcomeId: string): ActionCoordinates {
  if (mode === 'EVENT_OUTCOME') return { targetEventId: eventId, targetOutcomeId: outcomeId }
  if (outcomeRole(mode, coordinates, eventId) === 'target') {
    return outcomeId === coordinates.sourceOutcomeId ? coordinates : { ...coordinates, targetOutcomeId: outcomeId }
  }
  return { targetEventId: eventId, sourceOutcomeId: outcomeId }
}

export function pickPlayer(mode: TargetMode, coordinates: ActionCoordinates, playerId: string, listSize: number): ActionCoordinates {
  if (mode === 'PLAYER_LIST') return { targetPlayerIds: toggled(coordinates.targetPlayerIds ?? [], playerId, listSize) }
  return { targetPlayerId: playerId }
}

export function pickDisguise(category: CardCategory): ActionCoordinates {
  return { disguiseCategory: category }
}

export function coordinatesComplete(mode: TargetMode, coordinates: ActionCoordinates, listSize: number): boolean {
  switch (mode) {
    case 'EVENT_OUTCOME':
      return Boolean(coordinates.targetEventId && coordinates.targetOutcomeId)
    case 'EVENT_OUTCOME_PAIR':
      return Boolean(
        coordinates.targetEventId &&
          coordinates.sourceOutcomeId &&
          coordinates.targetOutcomeId &&
          coordinates.sourceOutcomeId !== coordinates.targetOutcomeId,
      )
    case 'EVENT_LIST':
      return (coordinates.targetEventIds?.length ?? 0) === listSize
    case 'PLAYER':
      return Boolean(coordinates.targetPlayerId)
    case 'PLAYER_LIST':
      return (coordinates.targetPlayerIds?.length ?? 0) === listSize
    case 'EVENT_ONLY':
      return Boolean(coordinates.targetEventId)
    case 'DISGUISE':
      return coordinates.disguiseCategory !== undefined && CARD_CATEGORIES.includes(coordinates.disguiseCategory)
    case 'NONE':
      return true
  }
}

/** What the board should ask for next, or null once the targets are complete. */
export function targetPrompt(mode: TargetMode, coordinates: ActionCoordinates, listSize: number): string | null {
  if (coordinatesComplete(mode, coordinates, listSize)) return null
  switch (mode) {
    case 'EVENT_OUTCOME':
      return 'Choose an outcome on an event card.'
    case 'EVENT_OUTCOME_PAIR':
      return coordinates.sourceOutcomeId
        ? 'Choose the outcome on the same event to shift toward.'
        : 'Choose the outcome to shift away from.'
    case 'EVENT_ONLY':
      return 'Choose an event card.'
    case 'EVENT_LIST':
      return `Choose ${listSize} event${listSize === 1 ? '' : 's'} (${coordinates.targetEventIds?.length ?? 0}/${listSize} chosen).`
    case 'PLAYER':
      return 'Choose a player in the player strip.'
    case 'PLAYER_LIST':
      return `Choose ${listSize} player${listSize === 1 ? '' : 's'} (${coordinates.targetPlayerIds?.length ?? 0}/${listSize} chosen).`
    case 'DISGUISE':
      return 'Choose the disguise shown in the round summary.'
    case 'NONE':
      return null
  }
}

interface TargetNames {
  readonly events: readonly ActiveEventOption[]
  readonly opponents: readonly OpponentOption[]
}

/** One line per chosen target, by event title, outcome description, player name or disguise. */
export function describeTargets(coordinates: ActionCoordinates, { events, opponents }: TargetNames): readonly string[] {
  const eventById = new Map(events.map((event) => [event.eventId, event]))
  const playerName = (playerId: string) => opponents.find((opponent) => opponent.playerId === playerId)?.playerName ?? 'Unknown player'
  const eventTitle = (eventId: string) => eventById.get(eventId)?.title ?? 'Unknown event'
  const outcomeDescription = (eventId: string | undefined, outcomeId: string) =>
    eventById.get(eventId ?? '')?.outcomes.find((outcome) => outcome.outcomeId === outcomeId)?.description ?? 'Unknown outcome'

  const lines: string[] = []
  const { targetEventId, sourceOutcomeId, targetOutcomeId } = coordinates
  if (targetEventId) {
    lines.push(`Event: ${eventTitle(targetEventId)}`)
  }
  if (sourceOutcomeId) {
    lines.push(`From: ${outcomeDescription(targetEventId, sourceOutcomeId)}`)
  }
  if (targetOutcomeId) {
    lines.push(`${sourceOutcomeId ? 'To' : 'Outcome'}: ${outcomeDescription(targetEventId, targetOutcomeId)}`)
  }
  for (const eventId of coordinates.targetEventIds ?? []) {
    lines.push(`Event: ${eventTitle(eventId)}`)
  }
  if (coordinates.targetPlayerId) {
    lines.push(`Player: ${playerName(coordinates.targetPlayerId)}`)
  }
  for (const playerId of coordinates.targetPlayerIds ?? []) {
    lines.push(`Player: ${playerName(playerId)}`)
  }
  if (coordinates.disguiseCategory) {
    lines.push(`Disguise: ${cardCategoryDisplayName(coordinates.disguiseCategory)}`)
  }
  return lines
}

export type SelectedChoice =
  | { readonly kind: 'card'; readonly card: HandCardOption }
  | { readonly kind: 'special'; readonly special: SpecialActionOption }
  | { readonly kind: 'pass' }

/** The draft resolved against the open round's options: what is chosen, how it targets, and whether it is ready. */
export interface ActionSelection {
  readonly choice: SelectedChoice | null
  /** Null for a pass or when nothing is chosen. */
  readonly targetMode: TargetMode | null
  readonly listSize: number
  readonly coordinates: ActionCoordinates
  readonly isComplete: boolean
}

export function actionSelectionFor(view: OpenActionRoundView, draft: ActionDraft): ActionSelection {
  const none: ActionSelection = { choice: null, targetMode: null, listSize: 0, coordinates: {}, isComplete: false }
  switch (draft.kind) {
    case 'none':
      return none
    case 'pass':
      return { ...none, choice: { kind: 'pass' }, isComplete: true }
    case 'card': {
      const card = view.hand.find((entry) => entry.cardInstanceId === draft.cardInstanceId)
      if (!card) return none
      const listSize = card.targetListSize ?? 0
      return {
        choice: { kind: 'card', card },
        targetMode: card.targetMode,
        listSize,
        coordinates: draft.coordinates,
        isComplete: coordinatesComplete(card.targetMode, draft.coordinates, listSize),
      }
    }
    case 'special': {
      const special = view.specials.find((entry) => entry.specialAction === draft.specialAction)
      if (!special) return none
      return {
        choice: { kind: 'special', special },
        targetMode: special.targetMode,
        listSize: 0,
        coordinates: draft.coordinates,
        isComplete: coordinatesComplete(special.targetMode, draft.coordinates, 0),
      }
    }
  }
}
