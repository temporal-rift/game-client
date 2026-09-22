import { describe, expect, it, vi } from 'vitest'
import { GameStateApiError, gameStateErrorMessage, getGameState } from './gameStateClient'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problemResponse(status: number, code: string, detail: string): Response {
  return new Response(JSON.stringify({ code, detail }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

const minimalPayload = {
  gameId: 'game-1',
  eraNumber: 2,
  phase: 'ACTION_ROUND_2',
  myScore: 3,
}

describe('getGameState', () => {
  it('requests the participant-scoped state endpoint', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(minimalPayload))
    await getGameState(fetchFn, 'https://api.example.test', 'game-1')
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.test/api/v1/games/game-1/state')
    expect(init.method).toBe('GET')
  })

  it('rejects without a network call when gameId is blank', async () => {
    const fetchFn = vi.fn()
    await expect(getGameState(fetchFn, 'https://api.example.test', '  ')).rejects.toThrow(/game reference/i)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('parses the reconciliation envelope, defaulting absent optional fields', async () => {
    const view = await getGameState(vi.fn().mockResolvedValue(jsonResponse(minimalPayload)), 'https://api.example.test', 'game-1')
    expect(view).toMatchObject({
      gameId: 'game-1',
      eraNumber: 2,
      phase: 'ACTION_ROUND_2',
      myScore: 3,
      revision: null,
      lastUpdatedAt: null,
      roundNumber: null,
      myFaction: null,
      deadlines: { handSelectionExpiresAt: null, actionRoundExpiresAt: null, paradoxResolutionExpiresAt: null },
      phaseContext: { declarationOpen: false, paradoxOpen: false, paradoxIds: [] },
      mySubmissions: [],
      mySpecialBudgets: [],
      result: null,
    })
    expect(view.raw).toEqual(minimalPayload)
  })

  it('parses revision, deadlines, phase context, submissions and budgets', async () => {
    const payload = {
      ...minimalPayload,
      revision: 42,
      lastUpdatedAt: '2026-02-01T00:00:00Z',
      roundNumber: 2,
      myFaction: 'WEAVERS',
      deadlines: { actionRoundExpiresAt: '2026-02-01T00:05:00Z' },
      phaseContext: { declarationOpen: false, paradoxOpen: true, paradoxIds: ['paradox-1'] },
      mySubmissions: [{ eraNumber: 2, roundNumber: 2, kind: 'ACTION', status: 'ACCEPTED', actionType: 'CARD' }],
      mySpecialBudgets: [{ specialAction: 'SEAL', remainingUsesThisEra: 1, remainingUsesThisGame: 2 }],
    }
    const view = await getGameState(vi.fn().mockResolvedValue(jsonResponse(payload)), 'https://api.example.test', 'game-1')
    expect(view.revision).toBe(42)
    expect(view.lastUpdatedAt).toBe('2026-02-01T00:00:00Z')
    expect(view.roundNumber).toBe(2)
    expect(view.myFaction).toBe('WEAVERS')
    expect(view.deadlines.actionRoundExpiresAt).toBe('2026-02-01T00:05:00Z')
    expect(view.phaseContext).toEqual({ declarationOpen: false, paradoxOpen: true, paradoxIds: ['paradox-1'] })
    expect(view.mySubmissions).toEqual([{ eraNumber: 2, roundNumber: 2, kind: 'ACTION', actionType: 'CARD' }])
    expect(view.mySpecialBudgets).toEqual([{ specialAction: 'SEAL', remainingUsesThisEra: 1, remainingUsesThisGame: 2 }])
  })

  it('accepts the authoritative hand-selection phase', async () => {
    const view = await getGameState(vi.fn().mockResolvedValue(jsonResponse({ ...minimalPayload, phase: 'HAND_SELECTION' })), 'https://api.example.test', 'game-1')
    expect(view.phase).toBe('HAND_SELECTION')
  })

  it('parses a terminal result', async () => {
    const payload = {
      ...minimalPayload,
      phase: 'GAME_ENDED',
      result: {
        endReason: 'SCORE_THRESHOLD',
        winners: [{ playerId: 'player-1', faction: 'PROPHETS' }],
        finalScores: [{ playerId: 'player-1', score: 12 }],
        revealBoundary: 'FACTIONS_AND_SCORES_PUBLIC',
      },
    }
    const view = await getGameState(vi.fn().mockResolvedValue(jsonResponse(payload)), 'https://api.example.test', 'game-1')
    expect(view.result).toEqual({
      endReason: 'SCORE_THRESHOLD',
      winners: [{ playerId: 'player-1', faction: 'PROPHETS' }],
      finalScores: [{ playerId: 'player-1', score: 12 }],
      revealBoundary: 'FACTIONS_AND_SCORES_PUBLIC',
    })
  })

  it('throws a GameStateApiError carrying the stable problem code on failure', async () => {
    const fetchFn = vi.fn().mockResolvedValue(problemResponse(404, '404-01', 'not found'))
    await expect(getGameState(fetchFn, 'https://api.example.test', 'game-1')).rejects.toMatchObject({
      status: 404,
      code: '404-01',
    })
  })

  it('rejects an unknown phase rather than fabricating one', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ ...minimalPayload, phase: 'MADE_UP' }))
    await expect(getGameState(fetchFn, 'https://api.example.test', 'game-1')).rejects.toThrow(/unknown phase/i)
  })

  it('propagates an AbortError untouched so callers can distinguish cancellation from failure', async () => {
    const abortError = new DOMException('aborted', 'AbortError')
    const fetchFn = vi.fn().mockRejectedValue(abortError)
    await expect(getGameState(fetchFn, 'https://api.example.test', 'game-1')).rejects.toBe(abortError)
  })

  it('wraps a network failure in a friendly, retryable error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('network down'))
    await expect(getGameState(fetchFn, 'https://api.example.test', 'game-1')).rejects.toThrow(/could not reach/i)
  })
})

describe('gameStateErrorMessage', () => {
  it('maps the not-a-participant code to a player-safe message', () => {
    expect(gameStateErrorMessage(new GameStateApiError(404, '404-01', 'raw detail'))).toMatch(/not a participant/i)
  })

  it('maps an expired session to a reauthentication prompt', () => {
    expect(gameStateErrorMessage(new GameStateApiError(401, null, 'raw detail'))).toMatch(/sign in again/i)
  })

  it('falls back to the server detail for unknown codes', () => {
    expect(gameStateErrorMessage(new GameStateApiError(500, 'weird', 'server exploded'))).toBe('server exploded')
  })
})
