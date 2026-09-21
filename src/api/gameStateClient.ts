/**
 * Participant-scoped game state HTTP client against the adopted projection
 * contract (`GET /api/v1/games/{gameId}/state`).
 *
 * `revision`/`lastUpdatedAt` are freshness markers for one game's projection
 * only; they never promise global or cross-topic event order. Only the
 * reconciliation-relevant envelope (revision, phase/round, deadlines, the
 * caller's own accepted decisions and special budgets, terminal result) is
 * validated here. Feature-specific fields (hand, active events, players,
 * revealed intel, bands, declarations, chain) are carried through unparsed
 * on `raw` for the feature module that owns them, so this shared layer does
 * not need to know their shape.
 */

export type GamePhase =
  | 'LOBBY'
  | 'ERA_START'
  | 'ACTION_ROUND_1'
  | 'ACTION_ROUND_2'
  | 'ACTION_ROUND_3'
  | 'PARADOX_RESOLUTION'
  | 'RESOLUTION'
  | 'ERA_END'
  | 'GAME_ENDED'

export type SubmissionKind = 'HAND_SELECTION' | 'DECLARATION' | 'ACTION' | 'PARADOX_CARD'

export interface MySubmissionView {
  readonly eraNumber: number
  readonly roundNumber: number | null
  readonly kind: SubmissionKind
  readonly actionType: 'CARD' | 'SPECIAL' | null
}

export interface SpecialBudgetView {
  readonly specialAction: string
  readonly remainingUsesThisEra: number
  readonly remainingUsesThisGame: number
}

export interface DeadlinesView {
  readonly handSelectionExpiresAt: string | null
  readonly actionRoundExpiresAt: string | null
  readonly paradoxResolutionExpiresAt: string | null
}

export interface PhaseContextView {
  readonly declarationOpen: boolean
  readonly paradoxOpen: boolean
  readonly paradoxIds: readonly string[]
}

export interface GameResultView {
  readonly endReason: string
  readonly winners: readonly { readonly playerId: string; readonly faction: string | null }[]
  readonly finalScores: readonly { readonly playerId: string; readonly score: number }[]
  readonly revealBoundary: string
}

export interface GameStateView {
  readonly gameId: string
  readonly eraNumber: number
  readonly revision: number | null
  readonly lastUpdatedAt: string | null
  readonly phase: GamePhase
  readonly roundNumber: number | null
  readonly myFaction: string | null
  readonly myScore: number
  readonly deadlines: DeadlinesView
  readonly phaseContext: PhaseContextView
  readonly mySubmissions: readonly MySubmissionView[]
  readonly mySpecialBudgets: readonly SpecialBudgetView[]
  readonly result: GameResultView | null
  /** Full response payload for feature modules that parse their own slice. */
  readonly raw: Record<string, unknown>
}

export type AuthenticatedFetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class GameStateApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(status: number, code: string | null, detail: string) {
    super(detail)
    this.name = 'GameStateApiError'
    this.status = status
    this.code = code
  }

  isCode(code: string): boolean {
    return this.code === code
  }
}

const KNOWN_PHASES: readonly GamePhase[] = [
  'LOBBY',
  'ERA_START',
  'ACTION_ROUND_1',
  'ACTION_ROUND_2',
  'ACTION_ROUND_3',
  'PARADOX_RESOLUTION',
  'RESOLUTION',
  'ERA_END',
  'GAME_ENDED',
]

const KNOWN_SUBMISSION_KINDS: readonly SubmissionKind[] = ['HAND_SELECTION', 'DECLARATION', 'ACTION', 'PARADOX_CARD']

function gameStateUrl(apiBaseUrl: string, gameId: string): string {
  const normalized = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl
  return `${normalized}/api/v1/games/${encodeURIComponent(gameId)}/state`
}

async function readJsonSafe(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const text = await response.text()
    if (!text) {
      return null
    }
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

async function throwProblem(response: Response, fallback: string): Promise<never> {
  const body = await readJsonSafe(response)
  const code = body ? stringField(body['code']) : null
  const detail = body ? (stringField(body['detail']) ?? fallback) : fallback
  throw new GameStateApiError(response.status, code, detail)
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Game state response is missing ${name}.`)
  }
  return value
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function parseDeadlines(value: unknown): DeadlinesView {
  const source = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  return {
    handSelectionExpiresAt: nullableString(source['handSelectionExpiresAt']),
    actionRoundExpiresAt: nullableString(source['actionRoundExpiresAt']),
    paradoxResolutionExpiresAt: nullableString(source['paradoxResolutionExpiresAt']),
  }
}

function parsePhaseContext(value: unknown): PhaseContextView {
  const source = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const paradoxIds = Array.isArray(source['paradoxIds'])
    ? source['paradoxIds'].filter((id): id is string => typeof id === 'string')
    : []
  return {
    declarationOpen: source['declarationOpen'] === true,
    paradoxOpen: source['paradoxOpen'] === true,
    paradoxIds,
  }
}

function parseSubmissionKind(value: unknown): SubmissionKind | null {
  return typeof value === 'string' && (KNOWN_SUBMISSION_KINDS as readonly string[]).includes(value)
    ? (value as SubmissionKind)
    : null
}

function parseActionType(value: unknown): 'CARD' | 'SPECIAL' | null {
  return value === 'CARD' || value === 'SPECIAL' ? value : null
}

function parseMySubmissions(value: unknown): readonly MySubmissionView[] {
  if (!Array.isArray(value)) {
    return []
  }
  const submissions: MySubmissionView[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const kind = parseSubmissionKind(source['kind'])
    const eraNumber = nullableNumber(source['eraNumber'])
    if (!kind || eraNumber === null) {
      continue
    }
    submissions.push({
      eraNumber,
      roundNumber: nullableNumber(source['roundNumber']),
      kind,
      actionType: parseActionType(source['actionType']),
    })
  }
  return submissions
}

function parseSpecialBudgets(value: unknown): readonly SpecialBudgetView[] {
  if (!Array.isArray(value)) {
    return []
  }
  const budgets: SpecialBudgetView[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const specialAction = stringField(source['specialAction'])
    const remainingUsesThisEra = nullableNumber(source['remainingUsesThisEra'])
    const remainingUsesThisGame = nullableNumber(source['remainingUsesThisGame'])
    if (!specialAction || remainingUsesThisEra === null || remainingUsesThisGame === null) {
      continue
    }
    budgets.push({ specialAction, remainingUsesThisEra, remainingUsesThisGame })
  }
  return budgets
}

function parseGameResult(value: unknown): GameResultView | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const source = value as Record<string, unknown>
  const endReason = stringField(source['endReason'])
  const revealBoundary = stringField(source['revealBoundary'])
  if (!endReason || !revealBoundary) {
    return null
  }
  const winners = Array.isArray(source['winners'])
    ? source['winners'].flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) {
          return []
        }
        const winner = entry as Record<string, unknown>
        const playerId = stringField(winner['playerId'])
        return playerId ? [{ playerId, faction: nullableString(winner['faction']) }] : []
      })
    : []
  const finalScores = Array.isArray(source['finalScores'])
    ? source['finalScores'].flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) {
          return []
        }
        const score = entry as Record<string, unknown>
        const playerId = stringField(score['playerId'])
        const scoreValue = nullableNumber(score['score'])
        return playerId && scoreValue !== null ? [{ playerId, score: scoreValue }] : []
      })
    : []
  return { endReason, winners, finalScores, revealBoundary }
}

function parseGameStateView(json: Record<string, unknown>): GameStateView {
  const phase = json['phase']
  if (typeof phase !== 'string' || !(KNOWN_PHASES as readonly string[]).includes(phase)) {
    throw new Error('Game state response carries an unknown phase.')
  }
  const myScore = json['myScore']
  if (typeof myScore !== 'number') {
    throw new TypeError('Game state response is missing myScore.')
  }
  const eraNumber = json['eraNumber']
  if (typeof eraNumber !== 'number') {
    throw new TypeError('Game state response is missing eraNumber.')
  }
  return {
    gameId: requireString(json['gameId'], 'gameId'),
    eraNumber,
    revision: nullableNumber(json['revision']),
    lastUpdatedAt: nullableString(json['lastUpdatedAt']),
    phase: phase as GamePhase,
    roundNumber: nullableNumber(json['roundNumber']),
    myFaction: nullableString(json['myFaction']),
    myScore,
    deadlines: parseDeadlines(json['deadlines']),
    phaseContext: parsePhaseContext(json['phaseContext']),
    mySubmissions: parseMySubmissions(json['mySubmissions']),
    mySpecialBudgets: parseSpecialBudgets(json['mySpecialBudgets']),
    result: parseGameResult(json['result']),
    raw: json,
  }
}

/**
 * Recovers the caller's participant-scoped game state. The reload-safe,
 * pollable read: never mutates server state, so it is always safe to retry.
 */
export async function getGameState(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
  init: { readonly signal?: AbortSignal } = {},
): Promise<GameStateView> {
  if (!gameId.trim()) {
    throw new Error('A game reference is needed to read its state.')
  }
  let response: Response
  try {
    response = await fetchFn(gameStateUrl(apiBaseUrl, gameId), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: init.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new Error('Could not reach the game server to read its state. Check your connection and try again.')
  }
  if (!response.ok) {
    await throwProblem(response, 'Could not read the game state. Try again.')
  }
  const json = await readJsonSafe(response)
  if (!json) {
    throw new Error('The server answered without game state. Refresh and try again.')
  }
  return parseGameStateView(json)
}

/** Maps stable problem codes to player-safe messages; unknown codes keep the server detail. */
export function gameStateErrorMessage(error: unknown): string {
  if (error instanceof GameStateApiError) {
    if (error.code === '404-01') {
      return 'Game not found, or you are not a participant of it.'
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
