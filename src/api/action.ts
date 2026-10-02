/**
 * Participant-scoped submissions against the pinned `action-api` contract:
 * hand selection, action-round actions and paradox-resolution choices.
 *
 * The server remains authoritative for card/special eligibility, target
 * legality and budgets; the generated schemas validate each request against
 * the contract before it is sent, and each response after it arrives.
 */

import * as z from 'zod'
import { apiClientsFor, apiErrorMessage, callApi, invalidRequestError, type AuthenticatedFetchFn } from './client'
import {
  selectHand as selectHandCall,
  submitAction as submitActionCall,
  submitParadoxResolutionCard as submitParadoxResolutionCall,
  type CardActionRequest,
  type EnumsSpecialAction as SpecialAction,
  type HandSelectionRequest,
  type HandSelectionResponse,
  type ParadoxResolutionCardRequest,
  type ParadoxResolutionCardResponse,
  type PassActionRequest,
  type SpecialActionRequest,
  type SubmitActionResponse,
} from './generated/action'
import {
  zCardActionRequest,
  zEnumsSpecialAction,
  zPassActionRequest,
  zSpecialActionRequest,
} from './generated/action/zod.gen'
import { zFaction } from './generated/scoring/zod.gen'
import { zEnumsCardCategory, zEnumsCardGrade, zEnumsCardType } from './generated/projection/zod.gen'
import type { Faction } from './generated/scoring'
import type { CardType } from './generated/projection'

export type { AuthenticatedFetchFn } from './client'
export type {
  CardActionRequest,
  EnumsSpecialAction as SpecialAction,
  PassActionRequest,
  SpecialActionRequest,
} from './generated/action'
export type { CardCategory, CardGrade, CardType } from './generated/projection'
export type { Faction } from './generated/scoring'

export const CARD_TYPES = zEnumsCardType.options
export const CARD_GRADES = zEnumsCardGrade.options
export const CARD_CATEGORIES = zEnumsCardCategory.options
export const SPECIAL_ACTIONS = zEnumsSpecialAction.options
export const FACTIONS = zFaction.options

// The projection contract carries some of these as free text (a hand card's `cardType`, the
// caller's `mySpecialActions` and `myFaction`); these narrow them to the enumerations the action
// contract accepts.
export function isCardType(value: string | null | undefined): value is CardType {
  return zEnumsCardType.safeParse(value).success
}

export function isSpecialAction(value: string | null | undefined): value is SpecialAction {
  return zEnumsSpecialAction.safeParse(value).success
}

export function isFaction(value: string | null | undefined): value is Faction {
  return zFaction.safeParse(value).success
}

/**
 * The precise coordinates for one action's target: every target field a
 * card or special request carries. Exactly the fields relevant to the chosen
 * card/special's target mode are populated by the caller.
 */
export type ActionCoordinates = Omit<CardActionRequest, 'actionType' | 'cardInstanceId'> &
  Omit<SpecialActionRequest, 'actionType' | 'specialAction'>

export type SubmitActionRequest = CardActionRequest | SpecialActionRequest | PassActionRequest

// The generated operation validates only the discriminator of its polymorphic body, so the
// wrapper checks the whole card, special or pass variant before sending it.
const submitActionRequestSchema = z.union([zCardActionRequest, zSpecialActionRequest, zPassActionRequest])

/**
 * Submits the authenticated player's single card, faction-special or pass
 * decision for an open action round. A lost response does not imply failure: recover
 * acceptance via game state before treating it as one.
 */
export async function submitAction(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
  eraNumber: number,
  roundNumber: number,
  request: SubmitActionRequest,
): Promise<SubmitActionResponse> {
  if (!gameId.trim()) {
    throw new Error('A game reference is needed to submit an action.')
  }
  if (!submitActionRequestSchema.safeParse(request).success) {
    throw invalidRequestError('submit the action')
  }
  const client = apiClientsFor(fetchFn, apiBaseUrl).action
  return callApi('submit the action', () =>
    submitActionCall({ client, path: { gameId, eraNumber, roundNumber }, body: request }),
  )
}

type FiveCards = HandSelectionRequest['keptCardInstanceIds']

function isFiveDistinctCards(ids: readonly string[]): ids is Readonly<FiveCards> {
  return ids.length === 5 && new Set(ids).size === 5
}

/**
 * Submits exactly five distinct caller-owned cards from the private pending
 * deal. The server remains authoritative for deal ownership and expiry.
 */
export async function submitHandSelection(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
  eraNumber: number,
  keptCardInstanceIds: readonly string[],
): Promise<HandSelectionResponse> {
  if (!gameId.trim()) {
    throw new Error('A game reference is needed to select a hand.')
  }
  if (!isFiveDistinctCards(keptCardInstanceIds)) {
    throw new Error('Choose exactly five different cards before confirming.')
  }
  const client = apiClientsFor(fetchFn, apiBaseUrl).action
  const [first, second, third, fourth, fifth] = keptCardInstanceIds
  return callApi('select the hand', () =>
    selectHandCall({ client, path: { gameId, eraNumber }, body: { keptCardInstanceIds: [first, second, third, fourth, fifth] } }),
  )
}

/** The caller's single choice for an open paradox-resolution phase: one eligible card on an affected event, or a pass. */
export type ParadoxResolutionChoice =
  | { readonly kind: 'card'; readonly cardInstanceId: string; readonly targetEventId: string; readonly targetOutcomeId: string }
  | { readonly kind: 'pass' }

function paradoxResolutionRequestFor(choice: ParadoxResolutionChoice): ParadoxResolutionCardRequest {
  if (choice.kind === 'pass') {
    return { actionType: 'PASS' }
  }
  const { cardInstanceId, targetEventId, targetOutcomeId } = choice
  return { actionType: 'CARD', cardInstanceId, targetEventId, targetOutcomeId }
}

/**
 * Submits the caller's card or explicit pass during the current paradox-resolution phase; a pass
 * spends no card. A lost response does not imply failure: recover acceptance via game state first.
 */
export async function submitParadoxResolution(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
  eraNumber: number,
  choice: ParadoxResolutionChoice,
): Promise<ParadoxResolutionCardResponse> {
  if (!gameId.trim()) {
    throw new Error('A game reference is needed to submit a paradox-resolution choice.')
  }
  const client = apiClientsFor(fetchFn, apiBaseUrl).action
  return callApi('submit the paradox-resolution choice', () =>
    submitParadoxResolutionCall({ client, path: { gameId, eraNumber }, body: paradoxResolutionRequestFor(choice) }),
  )
}

/** Maps stable problem codes to player-safe messages; unknown codes keep the server detail. */
export function actionErrorMessage(error: unknown): string {
  return apiErrorMessage(error, (problem) => {
    switch (problem.code) {
      case '409-01':
        return 'The round already closed. Reconciling your accepted action.'
      case '409-02':
        return 'You already submitted for this round. Reconciling your accepted action.'
      case '409-08':
        return 'The hand-selection window already closed. Reconciling your accepted hand.'
      case '409-09':
        return 'Your hand selection is already resolved. Reconciling your accepted hand.'
      case '409-06':
        return 'The paradox-resolution phase already closed. Reconciling your accepted choice.'
      case '409-07':
        return 'You already submitted a paradox-resolution choice. Reconciling your accepted choice.'
      case '409-05':
        return 'Expose was already used this era.'
      case '409-10':
        return 'That special action was already used this era.'
      case '422-01':
        return 'That card is not in your hand.'
      case '422-02':
        return 'You are jammed and cannot use faction specials right now.'
      case '422-03':
        return 'That target is not legal for this action.'
      case '422-04':
        return 'A faction is required to use a special action.'
      case '422-05':
        return 'Your faction does not own that special action.'
      case '422-06':
        return "That target does not belong to the current game's era."
      case '422-09':
        return 'Expose is not available this round, or that player cannot be exposed.'
      case '422-10':
        return 'That card is not eligible during this phase.'
      case '422-11':
        return 'Choose five different cards from your offered hand.'
      case '422-12':
        return 'That card or special cannot be played in this round.'
      default:
        return problem.status === 404 ? 'Round or target player not found.' : null
    }
  })
}
