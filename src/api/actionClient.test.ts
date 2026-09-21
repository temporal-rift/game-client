import { describe, expect, it, vi } from 'vitest'
import {
  ActionApiError,
  actionErrorMessage,
  getParadoxResolutionStatus,
  getRoundStatus,
  submitAction,
  submitParadoxResolutionCard,
} from './actionClient'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problemResponse(status: number, code: string, detail: string): Response {
  return new Response(JSON.stringify({ code, detail }), { status, headers: { 'Content-Type': 'application/problem+json' } })
}

describe('submitAction', () => {
  it('posts a card action with scalar event/outcome coordinates', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ gameId: 'game-1', eraNumber: 2, roundNumber: 1, playerId: 'p1', status: 'SUBMITTED', roundClosed: false }))
    await submitAction(fetchFn, 'https://api.example.test', 'game-1', 2, 1, {
      actionType: 'CARD',
      cardInstanceId: 'card-1',
      coordinates: { targetEventId: 'evt-1', targetOutcomeId: 'out-1' },
    })
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.test/api/v1/games/game-1/eras/2/rounds/1/actions')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      actionType: 'CARD',
      cardInstanceId: 'card-1',
      targetEventId: 'evt-1',
      targetOutcomeId: 'out-1',
    })
  })

  it('omits absent coordinate fields for a no-target special', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ gameId: 'game-1', eraNumber: 2, roundNumber: 1, playerId: 'p1', status: 'SUBMITTED', roundClosed: false }))
    await submitAction(fetchFn, 'https://api.example.test', 'game-1', 2, 1, {
      actionType: 'SPECIAL',
      specialAction: 'OBSCURE',
      coordinates: {},
    })
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ actionType: 'SPECIAL', specialAction: 'OBSCURE' })
  })

  it('posts Thread as an event/outcome target, never source fields', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ gameId: 'game-1', eraNumber: 2, roundNumber: 1, playerId: 'p1', status: 'SUBMITTED', roundClosed: false }))
    await submitAction(fetchFn, 'https://api.example.test', 'game-1', 2, 1, {
      actionType: 'SPECIAL',
      specialAction: 'THREAD',
      coordinates: { targetEventId: 'evt-1', targetOutcomeId: 'out-1' },
    })
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({ actionType: 'SPECIAL', specialAction: 'THREAD', targetEventId: 'evt-1', targetOutcomeId: 'out-1' })
    expect(body.sourceEventId).toBeUndefined()
    expect(body.sourceOutcomeId).toBeUndefined()
  })

  it('rejects without a network call when gameId is blank', async () => {
    const fetchFn = vi.fn()
    await expect(
      submitAction(fetchFn, 'https://api.example.test', '  ', 2, 1, { actionType: 'SPECIAL', specialAction: 'OBSCURE', coordinates: {} }),
    ).rejects.toThrow(/game reference/i)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('throws ActionApiError with the problem code on a rejection', async () => {
    const fetchFn = vi.fn().mockResolvedValue(problemResponse(422, '422-03', 'Invalid target'))
    const error = await submitAction(fetchFn, 'https://api.example.test', 'game-1', 2, 1, {
      actionType: 'CARD',
      cardInstanceId: 'card-1',
      coordinates: { targetEventId: 'evt-1', targetOutcomeId: 'out-1' },
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ActionApiError)
    expect((error as ActionApiError).isCode('422-03')).toBe(true)
  })
})

describe('getRoundStatus', () => {
  it('requests the round status endpoint and parses mySubmission', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        eraNumber: 2,
        roundNumber: 1,
        status: 'OPEN',
        timerRemainingSeconds: 30,
        submittedCount: 1,
        totalPlayers: 3,
        pendingPlayerIds: ['p2', 'p3'],
        mySubmission: { submitted: true, actionType: 'CARD' },
      }),
    )
    const view = await getRoundStatus(fetchFn, 'https://api.example.test', 'game-1', 2, 1)
    const [url] = fetchFn.mock.calls[0] as [string]
    expect(url).toBe('https://api.example.test/api/v1/games/game-1/eras/2/rounds/1/status')
    expect(view).toEqual({
      eraNumber: 2,
      roundNumber: 1,
      status: 'OPEN',
      timerRemainingSeconds: 30,
      submittedCount: 1,
      totalPlayers: 3,
      pendingPlayerIds: ['p2', 'p3'],
      mySubmission: { submitted: true, actionType: 'CARD' },
    })
  })

  it('defaults mySubmission to null when absent', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ eraNumber: 2, roundNumber: 1, status: 'OPEN', timerRemainingSeconds: null, submittedCount: 0, totalPlayers: 3, pendingPlayerIds: [] }),
    )
    const view = await getRoundStatus(fetchFn, 'https://api.example.test', 'game-1', 2, 1)
    expect(view.mySubmission).toBeNull()
  })
})

describe('paradox resolution', () => {
  it('recovers only caller-safe eligible cards and affected event targets', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        eraNumber: 2,
        phaseOpen: true,
        timerRemainingSeconds: 30,
        submittedCount: 1,
        totalPlayers: 3,
        pendingPlayerIds: ['p2', 'p3'],
        mySubmitted: false,
        affectedEventIds: ['evt-1'],
        eligibleCards: [{ cardInstanceId: 'offer-1', cardType: 'STABILIZE', grade: 'I' }],
      }),
    )

    const view = await getParadoxResolutionStatus(fetchFn, 'https://api.example.test', 'game-1', 2)

    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://api.example.test/api/v1/games/game-1/eras/2/paradox-resolution/status')
    expect(view.affectedEventIds).toEqual(['evt-1'])
    expect(view.eligibleCards).toEqual([{ cardInstanceId: 'offer-1', cardType: 'STABILIZE', grade: 'I' }])
  })

  it('posts a phase-scoped card choice without an ordinary action payload', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ gameId: 'game-1', eraNumber: 2, playerId: 'p1', status: 'SUBMITTED' }))

    await submitParadoxResolutionCard(fetchFn, 'https://api.example.test', 'game-1', 2, {
      cardInstanceId: 'offer-1',
      targetEventId: 'evt-1',
      targetOutcomeId: 'out-1',
    })

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.test/api/v1/games/game-1/eras/2/paradox-resolution/actions')
    expect(JSON.parse(init.body as string)).toEqual({ cardInstanceId: 'offer-1', targetEventId: 'evt-1', targetOutcomeId: 'out-1' })
  })
})

describe('actionErrorMessage', () => {
  it.each([
    ['409-01', /already closed/i],
    ['409-02', /already submitted/i],
    ['409-06', /phase already closed/i],
    ['409-07', /already submitted a paradox/i],
    ['409-05', /expose/i],
    ['409-10', /already used this era/i],
    ['422-01', /not in your hand/i],
    ['422-02', /jammed/i],
    ['422-03', /not legal/i],
    ['422-04', /faction is required/i],
    ['422-05', /does not own/i],
    ['422-06', /current game's era/i],
    ['422-10', /not eligible/i],
    ['422-12', /this specific round/i],
  ])('maps code %s to a player-safe message', (code, pattern) => {
    expect(actionErrorMessage(new ActionApiError(422, code, 'raw detail'))).toMatch(pattern)
  })

  it('falls back to the server detail for an unknown code', () => {
    expect(actionErrorMessage(new ActionApiError(422, '422-99', 'raw detail'))).toBe('raw detail')
  })
})
