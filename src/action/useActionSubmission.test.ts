import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedFetchFn } from '../api/gameStateClient'
import type { GameStateView } from '../api/gameStateClient'
import { createGameStateSession } from '../game/gameStateTestSupport'
import { useActionSubmission } from './useActionSubmission'

function stateBody(overrides: Record<string, unknown> = {}): GameStateView {
  const body = {
    gameId: 'game-1',
    eraNumber: 2,
    revision: 1,
    phase: 'ACTION_ROUND_1',
    roundNumber: 1,
    myFaction: 'ERASERS',
    myScore: 0,
    myHand: [{ cardInstanceId: 'card-1', cardType: 'PUSH', grade: 'II', isPlayableThisRound: true }],
    activeEvents: [{ eventId: 'evt-1', title: 'Evt', carryOverState: 'FRESH', outcomes: [{ outcomeId: 'out-1', description: 'Out' }] }],
    mySpecialActions: [],
    mySubmissions: [],
    ...overrides,
  }
  return { ...body, raw: body } as unknown as GameStateView
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problemResponse(status: number, code: string): Response {
  return new Response(JSON.stringify({ code, detail: 'rejected' }), { status, headers: { 'Content-Type': 'application/problem+json' } })
}

const BASE_OPTIONS = { apiBaseUrl: 'https://api.example.test', ownPlayerId: 'me' }

describe('useActionSubmission', () => {
  it('submits a selected card with its coordinates and clears the draft on acceptance', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ gameId: 'game-1', eraNumber: 2, roundNumber: 1, playerId: 'me', status: 'SUBMITTED', roundClosed: false }),
    )
    const fetchFn = fetchMock as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({ state: stateBody() })

    const { result } = renderHook(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState }))

    act(() => result.current.selectCard('card-1', { targetEventId: 'evt-1', targetOutcomeId: 'out-1' }))
    expect(result.current.draft).toEqual({ kind: 'card', cardInstanceId: 'card-1', coordinates: { targetEventId: 'evt-1', targetOutcomeId: 'out-1' } })

    await act(async () => {
      await result.current.confirm()
    })

    expect(result.current.submitPhase).toEqual({ kind: 'submitted' })
    expect(result.current.draft).toEqual({ kind: 'none' })
    expect(gameState.refresh).toHaveBeenCalledTimes(1)
    const postCall = fetchMock.mock.calls[0]
    expect(JSON.parse((postCall[1] as RequestInit).body as string)).toEqual({
      actionType: 'CARD',
      cardInstanceId: 'card-1',
      targetEventId: 'evt-1',
      targetOutcomeId: 'out-1',
    })
  })

  it('recovers acceptance after a lost response instead of reporting failure', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('network down')
    }) as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({
      state: stateBody(),
      refresh: async () => stateBody({ revision: 2, mySubmissions: [{ eraNumber: 2, roundNumber: 1, kind: 'ACTION', actionType: 'CARD' }] }),
    })

    const { result } = renderHook(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState }))

    act(() => result.current.selectCard('card-1', { targetEventId: 'evt-1', targetOutcomeId: 'out-1' }))
    await act(async () => {
      await result.current.confirm()
    })

    expect(result.current.submitPhase).toEqual({ kind: 'submitted' })
    expect(result.current.draft).toEqual({ kind: 'none' })
  })

  it('preserves the draft and reports a rejection when the action is genuinely invalid', async () => {
    const fetchFn = vi.fn(async () => problemResponse(422, '422-03')) as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({
      state: stateBody(),
      refresh: async () => stateBody({ revision: 1, mySubmissions: [] }),
    })

    const { result } = renderHook(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState }))

    act(() => result.current.selectCard('card-1', { targetEventId: 'evt-1', targetOutcomeId: 'out-1' }))
    await act(async () => {
      await result.current.confirm()
    })

    expect(result.current.submitPhase).toMatchObject({ kind: 'rejected', code: '422-03' })
    expect(result.current.draft).toEqual({ kind: 'card', cardInstanceId: 'card-1', coordinates: { targetEventId: 'evt-1', targetOutcomeId: 'out-1' } })
  })

  it('clears a stale draft once the round already shows an accepted submission', () => {
    const fetchFn = vi.fn() as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({
      state: stateBody({ mySubmissions: [{ eraNumber: 2, roundNumber: 1, kind: 'ACTION', actionType: 'CARD' }] }),
    })

    const { result } = renderHook(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState }))

    expect(result.current.view.kind).toBe('open')
    if (result.current.view.kind === 'open') {
      expect(result.current.view.hasSubmitted).toBe(true)
    }
    expect(result.current.draft).toEqual({ kind: 'none' })
  })
})
