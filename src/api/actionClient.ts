/**
 * Participant-scoped action-submission HTTP client against the adopted
 * action-round contracts (`POST .../rounds/{roundNumber}/actions`,
 * `GET .../rounds/{roundNumber}/status`).
 *
 * The server remains authoritative for card/special eligibility, target
 * legality and budgets; this client only shapes the request and parses the
 * response. Clients branch on stable problem `code` values, never on
 * free-text `detail`.
 */

import { readJsonSafe, stringField } from './httpJson'

export type CardType =
  | 'PUSH'
  | 'SUPPRESS'
  | 'SWING'
  | 'AMPLIFY'
  | 'INTERCEPT'
  | 'SCAN'
  | 'TRACE'
  | 'DECOY'
  | 'JAM'
  | 'STALL'
  | 'REDIRECT'
  | 'NULLIFY'
  | 'COLLIDE'
  | 'STABILIZE'
  | 'DETONATE'

export type CardGrade = 'I' | 'II' | 'III'

export type SpecialAction =
  | 'ANNIHILATE'
  | 'CORRUPT'
  | 'CASCADE'
  | 'FORESIGHT'
  | 'SEAL'
  | 'FULFILLMENT'
  | 'REWRITE'
  | 'MIMIC'
  | 'OBSCURE'
  | 'THREAD'
  | 'TAPESTRY'
  | 'REWEAVE'
  | 'RALLY'
  | 'EXPOSE'
  | 'MOMENTUM'

export type Faction = 'ERASERS' | 'PROPHETS' | 'REVISIONISTS' | 'WEAVERS' | 'ACTIVISTS'

export const CARD_TYPES: readonly CardType[] = [
  'PUSH',
  'SUPPRESS',
  'SWING',
  'AMPLIFY',
  'INTERCEPT',
  'SCAN',
  'TRACE',
  'DECOY',
  'JAM',
  'STALL',
  'REDIRECT',
  'NULLIFY',
  'COLLIDE',
  'STABILIZE',
  'DETONATE',
]

export const SPECIAL_ACTIONS: readonly SpecialAction[] = [
  'ANNIHILATE',
  'CORRUPT',
  'CASCADE',
  'FORESIGHT',
  'SEAL',
  'FULFILLMENT',
  'REWRITE',
  'MIMIC',
  'OBSCURE',
  'THREAD',
  'TAPESTRY',
  'REWEAVE',
  'RALLY',
  'EXPOSE',
  'MOMENTUM',
]

export const FACTIONS: readonly Faction[] = ['ERASERS', 'PROPHETS', 'REVISIONISTS', 'WEAVERS', 'ACTIVISTS']

export const CARD_GRADES: readonly CardGrade[] = ['I', 'II', 'III']

/**
 * The precise coordinates for one action's target, in the shapes the
 * contract accepts. Exactly the fields relevant to the chosen card/special's
 * target mode are populated by the caller; `JSON.stringify` drops the rest.
 */
export interface ActionCoordinates {
  readonly targetEventId?: string
  readonly targetEventIds?: readonly string[]
  readonly sourceOutcomeId?: string
  readonly targetOutcomeId?: string
  readonly targetPlayerId?: string
}

export interface SubmitCardActionRequest {
  readonly actionType: 'CARD'
  readonly cardInstanceId: string
  readonly coordinates: ActionCoordinates
}

export interface SubmitSpecialActionRequest {
  readonly actionType: 'SPECIAL'
  readonly specialAction: SpecialAction
  readonly coordinates: ActionCoordinates
}

export type SubmitActionRequest = SubmitCardActionRequest | SubmitSpecialActionRequest

export interface SubmitActionResult {
  readonly gameId: string
  readonly eraNumber: number
  readonly roundNumber: number
  readonly playerId: string
  readonly status: 'SUBMITTED'
  readonly roundClosed: boolean
}

export interface MyRoundSubmissionView {
  readonly submitted: boolean
  readonly actionType: 'CARD' | 'SPECIAL' | null
}

export interface RoundStatusView {
  readonly eraNumber: number
  readonly roundNumber: number
  readonly status: 'OPEN' | 'CLOSED'
  readonly timerRemainingSeconds: number | null
  readonly submittedCount: number
  readonly totalPlayers: number
  readonly pendingPlayerIds: readonly string[]
  readonly mySubmission: MyRoundSubmissionView | null
}

export type AuthenticatedFetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class ActionApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(status: number, code: string | null, detail: string) {
    super(detail)
    this.name = 'ActionApiError'
    this.status = status
    this.code = code
  }

  isCode(code: string): boolean {
    return this.code === code
  }
}

function actionsUrl(apiBaseUrl: string, gameId: string, eraNumber: number, roundNumber: number): string {
  const normalized = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl
  return `${normalized}/api/v1/games/${encodeURIComponent(gameId)}/eras/${eraNumber}/rounds/${roundNumber}/actions`
}

function roundStatusUrl(apiBaseUrl: string, gameId: string, eraNumber: number, roundNumber: number): string {
  const normalized = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl
  return `${normalized}/api/v1/games/${encodeURIComponent(gameId)}/eras/${eraNumber}/rounds/${roundNumber}/status`
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

async function throwProblem(response: Response, fallback: string): Promise<never> {
  const body = await readJsonSafe(response)
  const code = body ? stringField(body['code']) : null
  const detail = body ? (stringField(body['detail']) ?? fallback) : fallback
  throw new ActionApiError(response.status, code, detail)
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Action response is missing ${name}.`)
  }
  return value
}

function requireNumber(value: unknown, name: string): number {
  if (typeof value !== 'number') {
    throw new TypeError(`Action response is missing ${name}.`)
  }
  return value
}

function buildRequestBody(request: SubmitActionRequest): Record<string, unknown> {
  const base: Record<string, unknown> =
    request.actionType === 'CARD'
      ? { actionType: 'CARD', cardInstanceId: request.cardInstanceId }
      : { actionType: 'SPECIAL', specialAction: request.specialAction }
  return { ...base, ...request.coordinates }
}

function parseSubmitActionResult(json: Record<string, unknown>): SubmitActionResult {
  const status = json['status']
  if (status !== 'SUBMITTED') {
    throw new Error('Action response carries an unknown status.')
  }
  return {
    gameId: requireString(json['gameId'], 'gameId'),
    eraNumber: requireNumber(json['eraNumber'], 'eraNumber'),
    roundNumber: requireNumber(json['roundNumber'], 'roundNumber'),
    playerId: requireString(json['playerId'], 'playerId'),
    status,
    roundClosed: json['roundClosed'] === true,
  }
}

function parseMySubmission(value: unknown): MyRoundSubmissionView | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const source = value as Record<string, unknown>
  const submitted = source['submitted']
  if (typeof submitted !== 'boolean') {
    return null
  }
  const actionType = source['actionType']
  return {
    submitted,
    actionType: actionType === 'CARD' || actionType === 'SPECIAL' ? actionType : null,
  }
}

function parsePendingPlayerIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function parseRoundStatusView(json: Record<string, unknown>): RoundStatusView {
  const status = json['status']
  if (status !== 'OPEN' && status !== 'CLOSED') {
    throw new Error('Round status response carries an unknown status.')
  }
  return {
    eraNumber: requireNumber(json['eraNumber'], 'eraNumber'),
    roundNumber: requireNumber(json['roundNumber'], 'roundNumber'),
    status,
    timerRemainingSeconds: nullableNumber(json['timerRemainingSeconds']),
    submittedCount: requireNumber(json['submittedCount'], 'submittedCount'),
    totalPlayers: requireNumber(json['totalPlayers'], 'totalPlayers'),
    pendingPlayerIds: parsePendingPlayerIds(json['pendingPlayerIds']),
    mySubmission: parseMySubmission(json['mySubmission']),
  }
}

async function postJson<T>(
  fetchFn: AuthenticatedFetchFn,
  url: string,
  body: Record<string, unknown>,
  parse: (json: Record<string, unknown>) => T,
  action: string,
): Promise<T> {
  let response: Response
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(`Could not reach the game server to ${action}. Check your connection and try again.`)
  }
  if (!response.ok) {
    await throwProblem(response, `Could not ${action}. Try again.`)
  }
  const json = await readJsonSafe(response)
  if (!json) {
    throw new Error(`The server answered without ${action} state. Refresh and try again.`)
  }
  return parse(json)
}

/**
 * Submits the authenticated player's single card or faction-special action
 * for an open action round. A lost response does not imply failure: recover
 * acceptance via `getRoundStatus`/game state before treating it as one.
 */
export function submitAction(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
  eraNumber: number,
  roundNumber: number,
  request: SubmitActionRequest,
): Promise<SubmitActionResult> {
  if (!gameId.trim()) {
    return Promise.reject(new Error('A game reference is needed to submit an action.'))
  }
  return postJson(
    fetchFn,
    actionsUrl(apiBaseUrl, gameId, eraNumber, roundNumber),
    buildRequestBody(request),
    parseSubmitActionResult,
    'submit the action',
  )
}

/** Recovers the caller's own round-submission state; the reload-safe, pollable read. */
export async function getRoundStatus(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
  eraNumber: number,
  roundNumber: number,
  init: { readonly signal?: AbortSignal } = {},
): Promise<RoundStatusView> {
  if (!gameId.trim()) {
    throw new Error('A game reference is needed to read round status.')
  }
  let response: Response
  try {
    response = await fetchFn(roundStatusUrl(apiBaseUrl, gameId, eraNumber, roundNumber), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: init.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new Error('Could not reach the game server to read round status. Check your connection and try again.')
  }
  if (!response.ok) {
    await throwProblem(response, 'Could not read round status. Try again.')
  }
  const json = await readJsonSafe(response)
  if (!json) {
    throw new Error('The server answered without round status. Refresh and try again.')
  }
  return parseRoundStatusView(json)
}

/** Maps stable problem codes to player-safe messages; unknown codes keep the server detail. */
export function actionErrorMessage(error: unknown): string {
  if (error instanceof ActionApiError) {
    switch (error.code) {
      case '409-01':
        return 'The round already closed. Reconciling your accepted action.'
      case '409-02':
        return 'You already submitted for this round. Reconciling your accepted action.'
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
      case '422-10':
        return 'That card cannot be played during an action round.'
      case '422-12':
        return 'That card cannot be played in this specific round.'
      default:
        break
    }
    if (error.status === 404) {
      return 'Round or target player not found.'
    }
    if (error.status === 401) {
      return 'Your session expired. Sign in again to continue.'
    }
    if (error.status === 429) {
      return 'Too many requests. Wait a moment and try again.'
    }
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Something went wrong. Try again.'
}
