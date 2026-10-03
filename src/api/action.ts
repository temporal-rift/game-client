/**
 * Participant-scoped submissions against the pinned `action-api` contract:
 * hand selection, Activist declarations, action-round actions and
 * paradox-resolution choices.
 *
 * The server remains authoritative for card/special eligibility, target
 * legality and budgets; the generated schemas validate each request against
 * the contract before it is sent, and each response after it arrives.
 */

import * as z from 'zod'
import { apiClientsFor, apiErrorMessage, callApi, invalidRequestError, type AuthenticatedFetchFn } from './client'
import {
  declineDeclaration as declineDeclarationCall,
  recordActivistDeclaration as recordActivistDeclarationCall,
  selectHand as selectHandCall,
  submitAction as submitActionCall,
  submitParadoxResolutionCard as submitParadoxResolutionCall,
  type ActivistDeclarationRequest,
  type ActivistDeclarationResponse,
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
  zActivistDeclarationRequest,
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
  ActivistDeclarationRequest,
  ActivistDeclarationResponse,
  CardActionRequest,
  EnumsSpecialAction as SpecialAction,
  PassActionRequest,
  SpecialActionRequest,
} from './generated/action'
export type { ActivistDeclarationMode } from './generated/projection'
export type { CardCategory, CardGrade, CardType } from './generated/projection'
export type { Faction } from './generated/scoring'

export const CARD_TYPES = zEnumsCardType.options
export const CARD_GRADES = zEnumsCardGrade.options
export const CARD_CATEGORIES = zEnumsCardCategory.options
export const SPECIAL_ACTIONS = zEnumsSpecialAction.options
export const FACTIONS = zFaction.options

export async function declineDeclaration(fetchFn: AuthenticatedFetchFn, apiBaseUrl: string, gameId: string, eraNumber: number) {
  const client = apiClientsFor(fetchFn, apiBaseUrl).action
  return callApi('decline the declaration', () => declineDeclarationCall({ client, path: { gameId, eraNumber } }))
}

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

/**
 * Records the caller's sole current-era Rally or eligible Momentum
 * declaration during the open declaration window. A lost response does not
 * imply failure: recover acceptance via game state before treating it as one.
 */
export async function submitDeclaration(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
  eraNumber: number,
  request: ActivistDeclarationRequest,
): Promise<ActivistDeclarationResponse> {
  if (!gameId.trim()) {
    throw new Error('A game reference is needed to submit a declaration.')
  }
  if (!zActivistDeclarationRequest.safeParse(request).success) {
    throw invalidRequestError('submit the declaration')
  }
  const client = apiClientsFor(fetchFn, apiBaseUrl).action
  return callApi('submit the declaration', () =>
    recordActivistDeclarationCall({ client, path: { gameId, eraNumber }, body: request }),
  )
}

const ACTION_PROBLEM_MESSAGES: ReadonlyMap<string, string> = new Map(Object.entries({
  '409-01': 'The round already closed. Reconciling your accepted action.',
  '409-02': 'You already submitted for this round. Reconciling your accepted action.',
  '409-03': 'The declaration window already closed. Reconciling your accepted declaration.',
  '409-04': 'You already declared this era. Reconciling your accepted declaration.',
  '409-05': 'Expose was already used this era.',
  '409-06': 'The paradox-resolution phase already closed. Reconciling your accepted choice.',
  '409-07': 'You already submitted a paradox-resolution choice. Reconciling your accepted choice.',
  '409-08': 'The hand-selection window already closed. Reconciling your accepted hand.',
  '409-09': 'Your hand selection is already resolved. Reconciling your accepted hand.',
  '409-10': 'That special action was already used this era.',
  '422-01': 'That card is not in your hand.',
  '422-02': 'You are jammed and cannot use faction specials right now.',
  '422-03': 'That target is not legal for this action.',
  '422-04': 'A faction is required to use a special action.',
  '422-05': 'Your faction does not own that special action.',
  '422-06': "That target does not belong to the current game's era.",
  '422-08': 'Momentum is not eligible this era. Choose Rally or wait for the window to close.',
  '422-09': 'Expose is not available this round, or that player cannot be exposed.',
  '422-10': 'That card is not eligible during this phase.',
  '422-11': 'Choose five different cards from your offered hand.',
  '422-12': 'That card or special cannot be played in this round.',
}))

/** Maps stable problem codes to player-safe messages; unknown codes keep the server detail. */
export function actionErrorMessage(error: unknown): string {
  return apiErrorMessage(error, (problem) => {
    const message = problem.code === null ? undefined : ACTION_PROBLEM_MESSAGES.get(problem.code)
    return message ?? (problem.status === 404 ? 'Round or target player not found.' : null)
  })
}
