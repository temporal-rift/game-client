import { describe, expect, it, vi } from 'vitest'
import { ApiProblemError } from './client'
import {
  actionErrorMessage,
  submitAction,
  submitHandSelection,
  submitParadoxResolutionCard,
} from './action'
import { uuid } from '../test/uuid'

const apiBaseUrl = 'https://api.example.test'
const gameId = uuid('game-1')
const playerId = uuid('p1')
const card = uuid('card-1')
const eventId = uuid('evt-1')
const outcomeId = uuid('out-1')

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problemResponse(status: number, code: string, detail: string): Response {
  return new Response(JSON.stringify({ code, detail }), { status, headers: { 'Content-Type': 'application/problem+json' } })
}

function submitted(): Response {
  return jsonResponse({ gameId, eraNumber: 2, roundNumber: 1, playerId, status: 'SUBMITTED', roundClosed: false }, 202)
}

function bodyOf(fetchFn: ReturnType<typeof vi.fn>): unknown {
  const [, init] = fetchFn.mock.calls[0] as [string, RequestInit]
  return JSON.parse(init.body as string)
}

describe('submitHandSelection', () => {
  const kept = ['card-1', 'card-2', 'card-3', 'card-4', 'card-5'].map(uuid)

  it('posts exactly five private card identities to the hand-selection endpoint', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ gameId, eraNumber: 2, playerId, status: 'SELECTED' }, 202))

    await submitHandSelection(fetchFn, apiBaseUrl, gameId, 2, kept)

    const [url] = fetchFn.mock.calls[0] as [string]
    expect(url).toBe(`https://api.example.test/api/v1/games/${gameId}/eras/2/hand-selection`)
    expect(bodyOf(fetchFn)).toEqual({ keptCardInstanceIds: kept })
  })

  it('does not submit an incomplete or duplicate selection', async () => {
    const fetchFn = vi.fn()
    await expect(submitHandSelection(fetchFn, apiBaseUrl, gameId, 2, [kept[0], ...kept.slice(0, 4)])).rejects.toThrow(/exactly five different/i)
    await expect(submitHandSelection(fetchFn, apiBaseUrl, gameId, 2, kept.slice(0, 4))).rejects.toThrow(/exactly five different/i)
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('submitAction', () => {
  it('posts a card action with scalar event/outcome coordinates', async () => {
    const fetchFn = vi.fn().mockResolvedValue(submitted())
    await submitAction(fetchFn, apiBaseUrl, gameId, 2, 1, {
      actionType: 'CARD',
      cardInstanceId: card,
      targetEventId: eventId,
      targetOutcomeId: outcomeId,
    })
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://api.example.test/api/v1/games/${gameId}/eras/2/rounds/1/actions`)
    expect(init.method).toBe('POST')
    expect(bodyOf(fetchFn)).toEqual({ actionType: 'CARD', cardInstanceId: card, targetEventId: eventId, targetOutcomeId: outcomeId })
  })

  it('posts a Decoy action with only its disguise category and no target', async () => {
    const fetchFn = vi.fn().mockResolvedValue(submitted())
    await submitAction(fetchFn, apiBaseUrl, gameId, 2, 1, { actionType: 'CARD', cardInstanceId: card, disguiseCategory: 'DISRUPTION' })
    expect(bodyOf(fetchFn)).toEqual({ actionType: 'CARD', cardInstanceId: card, disguiseCategory: 'DISRUPTION' })
  })

  it('posts a no-target special with nothing but its name', async () => {
    const fetchFn = vi.fn().mockResolvedValue(submitted())
    await submitAction(fetchFn, apiBaseUrl, gameId, 2, 1, { actionType: 'SPECIAL', specialAction: 'OBSCURE' })
    expect(bodyOf(fetchFn)).toEqual({ actionType: 'SPECIAL', specialAction: 'OBSCURE' })
  })

  it('posts a pass with no card, special or target', async () => {
    const fetchFn = vi.fn().mockResolvedValue(submitted())
    await submitAction(fetchFn, apiBaseUrl, gameId, 2, 1, { actionType: 'PASS' })
    const [url] = fetchFn.mock.calls[0] as [string]
    expect(url).toBe(`https://api.example.test/api/v1/games/${gameId}/eras/2/rounds/1/actions`)
    expect(bodyOf(fetchFn)).toEqual({ actionType: 'PASS' })
  })

  it('posts Thread as an event/outcome target, never source fields', async () => {
    const fetchFn = vi.fn().mockResolvedValue(submitted())
    await submitAction(fetchFn, apiBaseUrl, gameId, 2, 1, {
      actionType: 'SPECIAL',
      specialAction: 'THREAD',
      targetEventId: eventId,
      targetOutcomeId: outcomeId,
    })
    expect(bodyOf(fetchFn)).toEqual({ actionType: 'SPECIAL', specialAction: 'THREAD', targetEventId: eventId, targetOutcomeId: outcomeId })
  })

  it('refuses a request the contract rejects before sending it', async () => {
    const fetchFn = vi.fn()
    await expect(
      submitAction(fetchFn, apiBaseUrl, gameId, 2, 1, { actionType: 'CARD', cardInstanceId: 'card-1', targetEventId: eventId }),
    ).rejects.toThrow(/does not match the game server's contract/i)
    await expect(submitAction(fetchFn, apiBaseUrl, '  ', 2, 1, { actionType: 'SPECIAL', specialAction: 'OBSCURE' })).rejects.toThrow(
      /game reference/i,
    )
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('throws ApiProblemError with the problem code on a rejection', async () => {
    const fetchFn = vi.fn().mockResolvedValue(problemResponse(422, '422-03', 'Invalid target'))
    const error = await submitAction(fetchFn, apiBaseUrl, gameId, 2, 1, {
      actionType: 'CARD',
      cardInstanceId: card,
      targetEventId: eventId,
      targetOutcomeId: outcomeId,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiProblemError)
    expect((error as ApiProblemError).isCode('422-03')).toBe(true)
  })
})

describe('paradox resolution', () => {
  it('posts a phase-scoped card choice without an ordinary action payload', async () => {
    const offer = uuid('offer-1')
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ gameId, eraNumber: 2, playerId, status: 'SUBMITTED' }, 202))

    await submitParadoxResolutionCard(fetchFn, apiBaseUrl, gameId, 2, { cardInstanceId: offer, targetEventId: eventId, targetOutcomeId: outcomeId })

    const [url] = fetchFn.mock.calls[0] as [string]
    expect(url).toBe(`https://api.example.test/api/v1/games/${gameId}/eras/2/paradox-resolution/actions`)
    expect(bodyOf(fetchFn)).toEqual({ actionType: 'CARD', cardInstanceId: offer, targetEventId: eventId, targetOutcomeId: outcomeId })
  })
})

describe('actionErrorMessage', () => {
  it.each([
    ['409-01', /already closed/i],
    ['409-02', /already submitted/i],
    ['409-08', /hand-selection window/i],
    ['409-09', /hand selection is already resolved/i],
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
    ['422-11', /five different cards/i],
    ['422-09', /expose is not available/i],
    ['422-12', /card or special cannot be played in this round/i],
  ])('maps code %s to a player-safe message', (code, pattern) => {
    expect(actionErrorMessage(new ApiProblemError(422, code, 'raw detail'))).toMatch(pattern)
  })

  it('falls back to the server detail for an unknown code', () => {
    expect(actionErrorMessage(new ApiProblemError(422, '422-99', 'raw detail'))).toBe('raw detail')
  })

  it('names a missing round or target for an uncoded 404', () => {
    expect(actionErrorMessage(new ApiProblemError(404, null, 'raw detail'))).toMatch(/round or target player not found/i)
  })
})
