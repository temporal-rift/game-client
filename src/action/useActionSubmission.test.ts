import { act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedFetchFn } from '../api/projection'
import type { GameStateView } from '../api/projection'
import { createGameStateSession } from '../game/gameStateTestSupport'
import { gameStatePayload } from '../test/gameStatePayload'
import { renderHookWithQueries } from '../test/renderWithQueries'
import { uuid } from '../test/uuid'
import { useActionSubmission } from './useActionSubmission'

const GAME = uuid('game-1')
const ME = uuid('me')
const CARD = uuid('card-1')
const NEXT_CARD = uuid('card-2')
const EVT = uuid('evt-1')
const OUT = uuid('out-1')

function stateBody(overrides: Partial<GameStateView> = {}): GameStateView {
  return gameStatePayload({
    gameId: GAME,
    revision: 1,
    phase: 'ACTION_ROUND_1',
    roundNumber: 1,
    myFaction: 'ERASERS',
    myScore: 0,
    myHand: [{ cardInstanceId: CARD, cardType: 'PUSH', grade: 'II', isPlayableThisRound: true }],
    activeEvents: [{ eventId: EVT, title: 'Evt', carryOverState: 'FRESH', outcomes: [{ outcomeId: OUT, description: 'Out', initialProbability: 100 }] }],
    mySpecialActions: [],
    mySubmissions: [],
    ...overrides,
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problemResponse(status: number, code: string): Response {
  return new Response(JSON.stringify({ code, detail: 'rejected' }), { status, headers: { 'Content-Type': 'application/problem+json' } })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const BASE_OPTIONS = { apiBaseUrl: 'https://api.example.test', ownPlayerId: ME }

describe('useActionSubmission', () => {
  it('submits a selected card with its coordinates and clears the draft on acceptance', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ gameId: GAME, eraNumber: 2, roundNumber: 1, playerId: ME, status: 'SUBMITTED', roundClosed: false }),
    )
    const fetchFn = fetchMock as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({ state: stateBody() })

    const { result } = renderHookWithQueries(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState }))

    act(() => result.current.selectCard(CARD, { targetEventId: EVT, targetOutcomeId: OUT }))
    expect(result.current.draft).toEqual({ kind: 'card', cardInstanceId: CARD, coordinates: { targetEventId: EVT, targetOutcomeId: OUT } })

    await act(async () => {
      await result.current.confirm()
    })

    expect(result.current.submitPhase).toEqual({ kind: 'awaiting-projection' })
    expect(result.current.draft).toEqual({ kind: 'none' })
    expect(gameState.refresh).toHaveBeenCalledTimes(1)
    const postCall = fetchMock.mock.calls[0]
    expect(JSON.parse((postCall[1] as RequestInit).body as string)).toEqual({
      actionType: 'CARD',
      cardInstanceId: CARD,
      targetEventId: EVT,
      targetOutcomeId: OUT,
    })
  })

  it('submits a Decoy draft with only its disguise category and no target', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ gameId: GAME, eraNumber: 2, roundNumber: 1, playerId: ME, status: 'SUBMITTED', roundClosed: false }),
    )
    const fetchFn = fetchMock as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({ state: stateBody() })

    const { result } = renderHookWithQueries(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState }))

    act(() => result.current.selectCard(CARD, { disguiseCategory: 'DISRUPTION' }))

    await act(async () => {
      await result.current.confirm()
    })

    expect(result.current.submitPhase).toEqual({ kind: 'awaiting-projection' })
    const postCall = fetchMock.mock.calls[0]
    expect(JSON.parse((postCall[1] as RequestInit).body as string)).toEqual({
      actionType: 'CARD',
      cardInstanceId: CARD,
      disguiseCategory: 'DISRUPTION',
    })
  })

  it('recovers acceptance after a lost response instead of reporting failure', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('network down')
    }) as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({
      state: stateBody(),
      refresh: async () => stateBody({ revision: 2, mySubmissions: [{ eraNumber: 2, roundNumber: 1, window: 'ACTION', choice: 'CARD', status: 'ACCEPTED' }] }),
    })

    const { result } = renderHookWithQueries(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState }))

    act(() => result.current.selectCard(CARD, { targetEventId: EVT, targetOutcomeId: OUT }))
    await act(async () => {
      await result.current.confirm()
    })

    expect(result.current.submitPhase).toEqual({ kind: 'awaiting-projection' })
    expect(result.current.draft).toEqual({ kind: 'none' })
  })

  it('preserves the draft and reports a rejection when the action is genuinely invalid', async () => {
    const fetchFn = vi.fn(async () => problemResponse(422, '422-03')) as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({
      state: stateBody(),
      refresh: async () => stateBody({ revision: 1, mySubmissions: [] }),
    })

    const { result } = renderHookWithQueries(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState }))

    act(() => result.current.selectCard(CARD, { targetEventId: EVT, targetOutcomeId: OUT }))
    await act(async () => {
      await result.current.confirm()
    })

    expect(result.current.submitPhase).toMatchObject({ kind: 'rejected', code: '422-03' })
    expect(result.current.draft).toEqual({ kind: 'card', cardInstanceId: CARD, coordinates: { targetEventId: EVT, targetOutcomeId: OUT } })
  })

  it('clears a stale draft once the round already shows an accepted submission', () => {
    const fetchFn = vi.fn() as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({
      state: stateBody({ mySubmissions: [{ eraNumber: 2, roundNumber: 1, window: 'ACTION', choice: 'CARD', status: 'ACCEPTED' }] }),
    })

    const { result } = renderHookWithQueries(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState }))

    expect(result.current.view.kind).toBe('open')
    if (result.current.view.kind === 'open') {
      expect(result.current.view.hasSubmitted).toBe(true)
    }
    expect(result.current.draft).toEqual({ kind: 'none' })
  })

  it.each(['success', 'error'] as const)('ignores a late %s refresh after the next round opens', async (completion) => {
    const fetchFn = vi.fn(async () => {
      if (completion === 'error') throw new TypeError('network down')
      return jsonResponse({ gameId: GAME, eraNumber: 2, roundNumber: 1, playerId: ME, status: 'SUBMITTED', roundClosed: false })
    }) as unknown as AuthenticatedFetchFn
    const refresh = deferred<GameStateView | null>()
    const firstRound = createGameStateSession({ state: stateBody(), refresh: () => refresh.promise })
    const laterRound = createGameStateSession({
      state: stateBody({
        phase: 'ACTION_ROUND_2',
        roundNumber: 2,
        myHand: [{ cardInstanceId: NEXT_CARD, cardType: 'PUSH', grade: 'II', isPlayableThisRound: true }],
      }),
    })
    const { result, rerender } = renderHookWithQueries(
      ({ gameState }) => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState }),
      { initialProps: { gameState: firstRound } },
    )

    act(() => result.current.selectCard(CARD, { targetEventId: EVT, targetOutcomeId: OUT }))
    act(() => {
      void result.current.confirm()
    })
    await waitFor(() => expect(firstRound.refresh).toHaveBeenCalledTimes(1))

    rerender({ gameState: laterRound })
    act(() => result.current.selectCard(NEXT_CARD, {}))
    const nextDraft = { kind: 'card', cardInstanceId: NEXT_CARD, coordinates: {} } as const
    expect(result.current.draft).toEqual(nextDraft)

    await act(async () => {
      refresh.resolve(stateBody({ revision: 2, mySubmissions: [{ eraNumber: 2, roundNumber: 1, window: 'ACTION', choice: 'CARD', status: 'ACCEPTED' }] }))
      await refresh.promise
    })

    expect(result.current.view).toMatchObject({ kind: 'open', roundNumber: 2 })
    expect(result.current.draft).toEqual(nextDraft)
    expect(result.current.submitPhase).toEqual({ kind: 'idle' })
  })
})
