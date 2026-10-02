import { describe, expect, it, vi } from 'vitest'
import { ApiProblemError } from './client'
import { gameStateErrorMessage, getGameState } from './projection'
import { gameStatePayload } from '../test/gameStatePayload'
import { uuid } from '../test/uuid'

const apiBaseUrl = 'https://api.example.test'
const gameId = uuid('game-1')

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problemResponse(status: number, code: string, detail: string): Response {
  return new Response(JSON.stringify({ code, detail }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

describe('getGameState', () => {
  it('requests the participant-scoped state endpoint', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(gameStatePayload()))
    await getGameState(fetchFn, apiBaseUrl, gameId)
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://api.example.test/api/v1/games/${gameId}/state`)
    expect(init.method).toBe('GET')
  })

  it('rejects without a network call when gameId is blank', async () => {
    const fetchFn = vi.fn()
    await expect(getGameState(fetchFn, apiBaseUrl, '  ')).rejects.toThrow(/game reference/i)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('returns the contract state exactly as served, absent optional fields staying absent', async () => {
    const payload = gameStatePayload()
    const view = await getGameState(vi.fn().mockResolvedValue(jsonResponse(payload)), apiBaseUrl, gameId)
    expect(view).toEqual(payload)
    expect(view.revision).toBeUndefined()
  })

  it('carries revision, deadlines, phase context, submissions, budgets and a terminal result', async () => {
    const paradoxId = uuid('paradox-1')
    const payload = gameStatePayload({
      revision: 42,
      lastUpdatedAt: '2026-02-01T00:00:00+01:00',
      roundNumber: 2,
      myFaction: 'WEAVERS',
      deadlines: { actionRoundExpiresAt: '2026-02-01T00:05:00Z' },
      phaseContext: {
        declarationOpen: false,
        paradoxOpen: true,
        paradoxes: [{ paradoxId, type: 'DEAD_HEAT', affectedEventId: uuid('event-1'), affectedOutcomeIds: [uuid('outcome-1')] }],
      },
      mySubmissions: [{ eraNumber: 2, roundNumber: 2, window: 'ACTION', choice: 'CARD', status: 'ACCEPTED' }],
      mySpecialBudgets: [{ specialAction: 'SEAL', remainingUsesThisEra: 1, remainingUsesThisGame: 2 }],
      phase: 'GAME_ENDED',
      result: {
        endReason: 'ALL_PLAYERS_ABANDONED',
        winners: [],
        finalScores: [{ playerId: uuid('player-1'), score: 12 }],
        revealBoundary: 'FACTIONS_AND_SCORES_PUBLIC',
      },
    })
    const view = await getGameState(vi.fn().mockResolvedValue(jsonResponse(payload)), apiBaseUrl, gameId)
    expect(view).toEqual(payload)
  })

  it('rejects a state that breaks the contract rather than fabricating one', async () => {
    const invalid: unknown[] = [
      { ...gameStatePayload(), phase: 'MADE_UP' },
      { ...gameStatePayload(), myHand: undefined },
      { ...gameStatePayload(), result: { endReason: 'SCORE_THRESHOLD', winners: [], finalScores: [], revealBoundary: 'FACTIONS_AND_SCORES_PUBLIC' } },
      gameStatePayload({ activeEvents: [{ eventId: uuid('event-1'), title: 'Event', carryOverState: 'FRESH', outcomes: [{ outcomeId: uuid('o'), description: 'O' }] }] as never }),
    ]
    for (const body of invalid) {
      const fetchFn = vi.fn().mockResolvedValue(jsonResponse(body))
      await expect(getGameState(fetchFn, apiBaseUrl, gameId)).rejects.toThrow(/could not read the game state: the game server's answer does not match its contract/i)
    }
  })

  it('throws an ApiProblemError carrying the stable problem code on failure', async () => {
    const fetchFn = vi.fn().mockResolvedValue(problemResponse(404, '404-01', 'not found'))
    await expect(getGameState(fetchFn, apiBaseUrl, gameId)).rejects.toMatchObject({
      status: 404,
      code: '404-01',
    })
  })

  it('keeps a rejection whose body is not a problem detail', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 }))
    const failure = await getGameState(fetchFn, apiBaseUrl, gameId).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ApiProblemError)
    expect(failure).toMatchObject({ status: 502, code: null, message: 'Could not read the game state. Try again.' })
  })

  it('propagates an AbortError untouched so callers can distinguish cancellation from failure', async () => {
    const abortError = new DOMException('aborted', 'AbortError')
    const fetchFn = vi.fn().mockRejectedValue(abortError)
    await expect(getGameState(fetchFn, apiBaseUrl, gameId)).rejects.toBe(abortError)
  })

  it('wraps a network failure in a friendly, retryable error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('network down'))
    await expect(getGameState(fetchFn, apiBaseUrl, gameId)).rejects.toThrow(/could not reach/i)
  })
})

describe('gameStateErrorMessage', () => {
  it('maps the not-a-participant code to a player-safe message', () => {
    expect(gameStateErrorMessage(new ApiProblemError(404, '404-01', 'raw detail'))).toMatch(/not a participant/i)
  })

  it('maps an expired session to a reauthentication prompt', () => {
    expect(gameStateErrorMessage(new ApiProblemError(401, null, 'raw detail'))).toMatch(/sign in again/i)
  })

  it('falls back to the server detail for unknown codes', () => {
    expect(gameStateErrorMessage(new ApiProblemError(500, 'weird', 'server exploded'))).toBe('server exploded')
  })
})
