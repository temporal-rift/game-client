/**
 * The generated contract clients (`src/api/generated/*`, one per backend
 * module pinned in `contracts.json`) wired to the configured API origin and
 * the caller's authenticated fetch. Every request and response is validated
 * against its contract by the generated Zod schemas; this module only turns
 * the ways a call can fail into errors the feature modules can explain.
 *
 * Clients branch on stable problem `code` values (`<status>-<nn>`), never on
 * free-text `detail`.
 */

import { ZodError } from 'zod'
import { createClient as createActionClient } from './generated/action/client'
import { createClient as createProjectionClient } from './generated/projection/client'
import { createClient as createScoringClient } from './generated/scoring/client'
import { createClient as createSessionClient } from './generated/session/client'
import type { Client } from './generated/session/client'

export type AuthenticatedFetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface ApiClients {
  readonly session: ReturnType<typeof createSessionClient>
  readonly action: ReturnType<typeof createActionClient>
  readonly projection: ReturnType<typeof createProjectionClient>
  readonly scoring: ReturnType<typeof createScoringClient>
}

/** An authoritative rejection: the server answered with a problem detail (or at least a status). */
export class ApiProblemError extends Error {
  readonly status: number
  readonly code: string | null
  /** Players blocking a start (`409-03`); null for every other problem. */
  readonly disconnectedPlayerIds: readonly string[] | null

  constructor(status: number, code: string | null, detail: string, disconnectedPlayerIds: readonly string[] | null = null) {
    super(detail)
    this.name = 'ApiProblemError'
    this.status = status
    this.code = code
    this.disconnectedPlayerIds = disconnectedPlayerIds
  }

  isCode(code: string): boolean {
    return this.code === code
  }
}

/** How a call failed before the operation's own wording is applied (see `callApi`). */
type Failure =
  | { readonly kind: 'problem'; readonly status: number; readonly code: string | null; readonly detail: string | null; readonly disconnectedPlayerIds: readonly string[] | null }
  | { readonly kind: 'unreachable' }
  | { readonly kind: 'invalid-request' }
  | { readonly kind: 'invalid-response' }

class ApiFailure extends Error {
  readonly failure: Failure

  constructor(failure: Failure) {
    super(failure.kind)
    this.name = 'ApiFailure'
    this.failure = failure
  }
}

/** Cancellation, not failure. Checked by name: the abort reason's class differs between realms. */
export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

function textField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function textList(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : null
}

// A problem body is read leniently: whatever the server sent, the status alone is still a rejection.
function problemFailure(body: unknown, status: number): Failure {
  const problem = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  return {
    kind: 'problem',
    status,
    code: textField(problem['code']),
    detail: textField(problem['detail']),
    disconnectedPlayerIds: textList(problem['disconnectedPlayerIds']),
  }
}

function classify(error: unknown, response: Response | undefined): unknown {
  if (isAbortError(error)) {
    return error
  }
  if (response && !response.ok) {
    return new ApiFailure(problemFailure(error, response.status))
  }
  if (error instanceof ZodError) {
    // The client validates the request before sending it and the response after receiving it.
    return new ApiFailure({ kind: response ? 'invalid-response' : 'invalid-request' })
  }
  if (response) {
    // An answered request whose body could not be read as the contract's JSON.
    return new ApiFailure({ kind: 'invalid-response' })
  }
  return new ApiFailure({ kind: 'unreachable' })
}

// The generated client hands fetch one Request; the authenticated fetch (and the fakes in tests)
// take the classic (input, init) pair, whose headers and body it extends.
function adaptFetch(fetchFn: AuthenticatedFetchFn) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    const body = request.body ? await request.text() : undefined
    // Server state is polled and reconciled here: a heuristically cached answer must never stand in for it.
    return fetchFn(request.url, { method: request.method, headers: request.headers, body, signal: request.signal, cache: 'no-store' })
  }
}

function configure<T extends Client>(client: T): T {
  client.interceptors.error.use((error, response) => classify(error, response))
  return client
}

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

/**
 * Creates the contract clients for one signed-in session. Callers must only
 * pass the trusted configured API origin: the authenticated fetch attaches
 * the player's Bearer token to every request these clients make.
 */
export function createApiClients(apiBaseUrl: string, fetchFn: AuthenticatedFetchFn): ApiClients {
  const config = { baseUrl: trimTrailingSlash(apiBaseUrl), fetch: adaptFetch(fetchFn), parseAs: 'json', throwOnError: true } as const
  return {
    session: configure(createSessionClient(config)),
    action: configure(createActionClient(config)),
    projection: configure(createProjectionClient(config)),
    scoring: configure(createScoringClient(config)),
  }
}

export function invalidRequestError(action: string): Error {
  return new Error(`Could not ${action}: the request does not match the game server's contract.`)
}

/**
 * Runs one contract call and words its failure for the player: `action`
 * completes "Could not … " (e.g. "join the lobby"). Authoritative
 * rejections stay `ApiProblemError`s so callers can branch on their code;
 * cancellation passes through untouched.
 */
export async function callApi<T>(action: string, run: () => Promise<{ readonly data?: T }>): Promise<T> {
  let data: T | undefined
  try {
    ;({ data } = await run())
  } catch (error) {
    if (!(error instanceof ApiFailure)) {
      throw isAbortError(error) ? error : new Error(`Could not ${action}. Try again.`, { cause: error })
    }
    const { failure } = error
    switch (failure.kind) {
      case 'problem':
        throw new ApiProblemError(failure.status, failure.code, failure.detail ?? `Could not ${action}. Try again.`, failure.disconnectedPlayerIds)
      case 'unreachable':
        throw new Error(`Could not reach the game server to ${action}. Check your connection and try again.`)
      case 'invalid-request':
        throw invalidRequestError(action)
      case 'invalid-response':
        throw new Error(`Could not ${action}: the game server's answer does not match its contract. Refresh and try again.`)
    }
  }
  if (data === undefined) {
    // The clients throw on every failure, so an answer always carries data; guard the contract anyway.
    throw new Error(`The server answered without ${action} state. Refresh and try again.`)
  }
  return data
}

/**
 * The player-facing message for a failed call. `messages` maps the
 * operation's stable problem codes; unknown codes keep the server detail so
 * authoritative errors are shown, never invented state.
 */
export function apiErrorMessage(error: unknown, messages: (error: ApiProblemError) => string | null = () => null): string {
  if (error instanceof ApiProblemError) {
    const mapped = messages(error)
    if (mapped) {
      return mapped
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

// Clients are cheap, but hooks call per render: reuse one set per fetch function and origin.
const clientCache = new WeakMap<AuthenticatedFetchFn, Map<string, ApiClients>>()

export function apiClientsFor(fetchFn: AuthenticatedFetchFn, apiBaseUrl: string): ApiClients {
  let byOrigin = clientCache.get(fetchFn)
  if (!byOrigin) {
    byOrigin = new Map()
    clientCache.set(fetchFn, byOrigin)
  }
  let clients = byOrigin.get(apiBaseUrl)
  if (!clients) {
    clients = createApiClients(apiBaseUrl, fetchFn)
    byOrigin.set(apiBaseUrl, clients)
  }
  return clients
}
