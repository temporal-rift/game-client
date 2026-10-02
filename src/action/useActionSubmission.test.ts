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
    expect(result.current.rejection).toBeNull()
    expect(fetchFn).toHaveBeenCalledTimes(1)
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

    expect(gameState.refresh).toHaveBeenCalledTimes(1)
    expect(result.current.submitPhase).toEqual({ kind: 'idle' })
    expect(result.current.rejection).toMatchObject({ code: '422-03', message: expect.stringMatching(/not legal/i) })
    expect(result.current.draft).toEqual({ kind: 'card', cardInstanceId: CARD, coordinates: { targetEventId: EVT, targetOutcomeId: OUT } })
  })

  it('keeps the rejection until the player makes a new choice or dismisses it', async () => {
    const fetchFn = vi.fn(async () => problemResponse(422, '422-03')) as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({ state: stateBody(), refresh: async () => stateBody() })
    const { result } = renderHookWithQueries(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState }))

    act(() => result.current.selectCard(CARD, { targetEventId: EVT, targetOutcomeId: OUT }))
    await act(async () => {
      await result.current.confirm()
    })
    expect(result.current.rejection).not.toBeNull()

    act(() => result.current.retarget({ targetEventId: EVT }))
    expect(result.current.rejection).toBeNull()
    expect(result.current.draft).toEqual({ kind: 'card', cardInstanceId: CARD, coordinates: { targetEventId: EVT } })

    act(() => result.current.retarget({ targetEventId: EVT, targetOutcomeId: OUT }))
    await act(async () => {
      await result.current.confirm()
    })
    act(() => result.current.dismissRejection())
    expect(result.current.rejection).toBeNull()
  })

  it('submits a pass with no card, special or target', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ gameId: GAME, eraNumber: 2, roundNumber: 1, playerId: ME, status: 'SUBMITTED', roundClosed: false }),
    )
    const gameState = createGameStateSession({
      state: stateBody(),
      refresh: async () => stateBody({ revision: 2, mySubmissions: [{ eraNumber: 2, roundNumber: 1, window: 'ACTION', choice: 'PASS', status: 'ACCEPTED' }] }),
    })
    const { result } = renderHookWithQueries(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn: fetchMock as unknown as AuthenticatedFetchFn, gameState }))

    act(() => result.current.choosePass())
    expect(result.current.draft).toEqual({ kind: 'pass' })
    await act(async () => {
      await result.current.confirm()
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe(`https://api.example.test/api/v1/games/${GAME}/eras/2/rounds/1/actions`)
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ actionType: 'PASS' })
    expect(result.current.draft).toEqual({ kind: 'none' })
    expect(result.current.rejection).toBeNull()
  })

  it('reports a pass rejected because the round closed, after refreshing into the next phase', async () => {
    const fetchFn = vi.fn(async () => problemResponse(409, '409-01')) as unknown as AuthenticatedFetchFn
    const refreshed = stateBody({ revision: 2, phase: 'RESOLUTION', roundNumber: null })
    const gameState = createGameStateSession({ state: stateBody(), refresh: async () => refreshed })
    const { result, rerender } = renderHookWithQueries(
      ({ session }) => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState: session }),
      { initialProps: { session: gameState } },
    )

    act(() => result.current.choosePass())
    await act(async () => {
      await result.current.confirm()
    })
    rerender({ session: createGameStateSession({ state: refreshed }) })

    expect(gameState.refresh).toHaveBeenCalledTimes(1)
    expect(result.current.view.kind).toBe('unavailable')
    expect(result.current.rejection).toMatchObject({ code: '409-01', message: expect.stringMatching(/round already closed/i) })
  })

  it('reports a pass rejected as a duplicate while showing the recorded submission', async () => {
    const fetchFn = vi.fn(async () => problemResponse(409, '409-02'))
    const accepted = stateBody({ revision: 2, mySubmissions: [{ eraNumber: 2, roundNumber: 1, window: 'ACTION', choice: 'CARD', status: 'ACCEPTED' }] })
    const gameState = createGameStateSession({ state: stateBody(), refresh: async () => accepted })
    const { result, rerender } = renderHookWithQueries(
      ({ session }) => useActionSubmission({ ...BASE_OPTIONS, fetchFn: fetchFn as unknown as AuthenticatedFetchFn, gameState: session }),
      { initialProps: { session: gameState } },
    )

    act(() => result.current.choosePass())
    await act(async () => {
      await result.current.confirm()
    })
    rerender({ session: createGameStateSession({ state: accepted }) })

    expect(result.current.rejection).toMatchObject({ code: '409-02', message: expect.stringMatching(/already submitted/i) })
    expect(result.current.view).toMatchObject({ kind: 'open', hasSubmitted: true })
    await act(async () => {
      await result.current.confirm()
    })
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('reports a failure without a server answer when the refreshed state records nothing', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('network down')
    }) as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({ state: stateBody(), refresh: async () => stateBody() })
    const { result } = renderHookWithQueries(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn, gameState }))

    act(() => result.current.selectCard(CARD, { targetEventId: EVT, targetOutcomeId: OUT }))
    await act(async () => {
      await result.current.confirm()
    })

    expect(result.current.rejection).toMatchObject({ code: null })
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
    expect(result.current.rejection).toBeNull()
  })
})
