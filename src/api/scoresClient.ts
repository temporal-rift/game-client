/**
 * Participant-scoped scoring HTTP client against the adopted scoring
 * contracts (`GET /api/v1/games/{gameId}/scores` and
 * `GET /api/v1/games/{gameId}/scores/history`).
 *
 * Factions stay hidden until the final reveal and score-change reasons are
 * entitled per viewer: before the reveal an opponent entry omits any
 * faction-identifying reason, while after the reveal permitted detailed
 * reasons may be present for every participant. The client never infers a
 * missing faction or reason and never derives winners from score order.
 */

export type AuthenticatedFetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class ScoresApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(status: number, code: string | null, detail: string) {
    super(detail)
    this.name = 'ScoresApiError'
    this.status = status
    this.code = code
  }

  isCode(code: string): boolean {
    return this.code === code
  }
}

export interface PlayerScoreView {
  readonly playerId: string
  readonly playerName: string
  readonly score: number
  readonly faction: string | null
}

export interface ScoresView {
  readonly gameId: string
  readonly eraNumber: number
  readonly scores: readonly PlayerScoreView[]
}

export interface ScoreDeltaView {
  readonly playerId: string
  readonly pointsDelta: number
  /** Entitled explanation; absent when withheld to protect hidden information. */
  readonly reason: string | null
}

export interface ScoresEraHistory {
  readonly eraNumber: number
  readonly deltas: readonly ScoreDeltaView[]
}

export interface ScoresHistoryView {
  readonly gameId: string
  readonly history: readonly ScoresEraHistory[]
}

function scoresUrl(apiBaseUrl: string, gameId: string, suffix: '' | '/history'): string {
  const normalized = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl
  return `${normalized}/api/v1/games/${encodeURIComponent(gameId)}/scores${suffix}`
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

function nullableFaction(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

async function throwProblem(response: Response, fallback: string): Promise<never> {
  const body = await readJsonSafe(response)
  const code = body ? stringField(body['code']) : null
  const detail = body ? (stringField(body['detail']) ?? fallback) : fallback
  throw new ScoresApiError(response.status, code, detail)
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Scores response is missing ${name}.`)
  }
  return value
}

function parsePlayerScore(value: unknown): PlayerScoreView {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Scores response is missing player score state.')
  }
  const source = value as Record<string, unknown>
  const score = source['score']
  if (typeof score !== 'number') {
    throw new TypeError('Scores response is missing player score state.')
  }
  return {
    playerId: requireString(source['playerId'], 'playerId'),
    playerName: requireString(source['playerName'], 'playerName'),
    score,
    faction: nullableFaction(source['faction']),
  }
}

function parseScoreDelta(value: unknown): ScoreDeltaView {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Score history response is missing delta state.')
  }
  const source = value as Record<string, unknown>
  const pointsDelta = source['pointsDelta']
  if (typeof pointsDelta !== 'number') {
    throw new TypeError('Score history response is missing delta state.')
  }
  const reason = source['reason']
  return {
    playerId: requireString(source['playerId'], 'playerId'),
    pointsDelta,
    reason: typeof reason === 'string' && reason.length > 0 ? reason : null,
  }
}

function parseScoresView(json: Record<string, unknown>): ScoresView {
  const eraNumber = json['eraNumber']
  if (typeof eraNumber !== 'number') {
    throw new TypeError('Scores response is missing era state.')
  }
  const scores = json['scores']
  if (!Array.isArray(scores)) {
    throw new TypeError('Scores response is missing score state.')
  }
  return {
    gameId: requireString(json['gameId'], 'game identity'),
    eraNumber,
    scores: scores.map(parsePlayerScore),
  }
}

function parseScoresHistoryView(json: Record<string, unknown>): ScoresHistoryView {
  const history = json['history']
  if (!Array.isArray(history)) {
    throw new TypeError('Score history response is missing history state.')
  }
  return {
    gameId: requireString(json['gameId'], 'game identity'),
    history: history.map((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        throw new Error('Score history response is missing era state.')
      }
      const source = entry as Record<string, unknown>
      const eraNumber = source['eraNumber']
      if (typeof eraNumber !== 'number') {
        throw new TypeError('Score history response is missing era state.')
      }
      const deltas = source['deltas']
      if (!Array.isArray(deltas)) {
        throw new TypeError('Score history response is missing delta state.')
      }
      return { eraNumber, deltas: deltas.map(parseScoreDelta) }
    }),
  }
}

async function getJson<T>(
  fetchFn: AuthenticatedFetchFn,
  url: string,
  action: string,
  parse: (json: Record<string, unknown>) => T,
  init: { readonly signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: init.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
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

/** Reads the participant-scoped current scores; factions are null until the final reveal. */
export function getScores(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
  init: { readonly signal?: AbortSignal } = {},
): Promise<ScoresView> {
  if (!gameId.trim()) {
    return Promise.reject(new Error('A game reference is needed to read its scores.'))
  }
  return getJson(fetchFn, scoresUrl(apiBaseUrl, gameId, ''), 'read the scores', parseScoresView, init)
}

/**
 * Reads the participant-scoped scoring history by era. Each viewer receives
 * only their entitled reasons; opponent reasons withheld to protect hidden
 * information arrive as null and must be shown as withheld, never guessed.
 */
export function getScoresHistory(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
  init: { readonly signal?: AbortSignal } = {},
): Promise<ScoresHistoryView> {
  if (!gameId.trim()) {
    return Promise.reject(new Error('A game reference is needed to read its score history.'))
  }
  return getJson(fetchFn, scoresUrl(apiBaseUrl, gameId, '/history'), 'read the score history', parseScoresHistoryView, init)
}

/** Maps stable problem codes to player-safe messages; unknown codes keep the server detail. */
export function scoresErrorMessage(error: unknown): string {
  if (error instanceof ScoresApiError) {
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
