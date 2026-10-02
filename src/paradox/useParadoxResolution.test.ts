import { act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedFetchFn, GameStateView } from '../api/projection'
import { createGameStateSession } from '../game/gameStateTestSupport'
import { gameStatePayload } from '../test/gameStatePayload'
import { renderHookWithQueries } from '../test/renderWithQueries'
import { uuid } from '../test/uuid'
import { useParadoxResolution } from './useParadoxResolution'

const GAME = uuid('game-1')
const OFFER = uuid('offer-1')
const NEXT_OFFER = uuid('offer-2')
const EVENT = uuid('event-1')
const OUTCOME = uuid('outcome-1')

function paradoxState(overrides: Partial<GameStateView> = {}): GameStateView {
  return gameStatePayload({
    gameId: GAME,
    revision: 1,
    phase: 'PARADOX_RESOLUTION',
    phaseContext: {
      declarationOpen: false,
      paradoxOpen: true,
      paradoxResolutionProgress: { submittedCount: 1, totalPlayers: 3, pendingPlayerIds: [] },
      affectedEventIds: [EVENT],
    },
    deadlines: { paradoxResolutionExpiresAt: '2030-01-01T00:00:00Z' },
    myEligibleResolutionCards: [{ cardInstanceId: OFFER, cardType: 'STABILIZE', grade: 'I' }],
    activeEvents: [{ eventId: EVENT, title: 'Event', carryOverState: 'FRESH', outcomes: [{ outcomeId: OUTCOME, description: 'Outcome', initialProbability: 100 }] }],
    ...overrides,
  })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function server(onSubmit: () => Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/paradox-resolution/actions') && init?.method === 'POST') return onSubmit()
    throw new Error(`Unexpected API call: ${init?.method ?? 'GET'} ${url}`)
  }) as unknown as AuthenticatedFetchFn & ReturnType<typeof vi.fn>
}

async function selectAndConfirm(result: { current: ReturnType<typeof useParadoxResolution> }): Promise<void> {
  await waitFor(() => expect(result.current.view.kind).toBe('open'))
  act(() => result.current.selectCard(OFFER))
  act(() => result.current.selectTarget(EVENT, OUTCOME))
  await act(async () => {
    await result.current.confirm()
  })
}

describe('useParadoxResolution', () => {
  it('uses projected cards and targets without calling a status endpoint', async () => {
    const fetchFn = server(async () => json({}))
    const gameState = createGameStateSession({ state: paradoxState() })
    const { result } = renderHookWithQueries(() => useParadoxResolution({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }))

    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'open', cards: [{ cardInstanceId: OFFER }], submittedCount: 1, totalPlayers: 3 }))
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('reconciles an accepted choice after a lost response from game state only', async () => {
    const fetchFn = server(async () => {
      throw new TypeError('response lost')
    })
    const accepted = paradoxState({
      revision: 2,
      mySubmissions: [{ eraNumber: 2, roundNumber: null, window: 'PARADOX_RESOLUTION', choice: 'CARD', status: 'ACCEPTED' }],
    })
    const gameState = createGameStateSession({ state: paradoxState(), refresh: async () => accepted })
    const { result } = renderHookWithQueries(() => useParadoxResolution({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }))

    await selectAndConfirm(result)

    expect(result.current.submitPhase).toEqual({ kind: 'awaiting-projection' })
    expect(result.current.draft).toEqual({ kind: 'none' })
    expect(fetchFn.mock.calls.map(([input]) => String(input))).toEqual([`https://api.example.test/api/v1/games/${GAME}/eras/2/paradox-resolution/actions`])
  })

  it('keeps the draft and reports a genuine rejection when game state has no accepted choice', async () => {
    const fetchFn = server(async () => json({ code: '422-10', detail: 'not eligible' }, 422))
    const gameState = createGameStateSession({ state: paradoxState(), refresh: async () => paradoxState() })
    const { result } = renderHookWithQueries(() => useParadoxResolution({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }))

    await selectAndConfirm(result)

    expect(result.current.rejection).toMatchObject({ code: '422-10' })
    expect(result.current.submitPhase).toEqual({ kind: 'idle' })
    expect(result.current.draft).toEqual({ kind: 'card', cardInstanceId: OFFER, target: { eventId: EVENT, outcomeId: OUTCOME } })
    expect(fetchFn.mock.calls.map(([input]) => String(input))).toEqual([`https://api.example.test/api/v1/games/${GAME}/eras/2/paradox-resolution/actions`])
  })

  it('submits an explicit pass with no card or target', async () => {
    const fetchFn = server(async () => json({ gameId: GAME, eraNumber: 2, playerId: uuid('player-1'), status: 'SUBMITTED' }, 202))
    const accepted = paradoxState({
      revision: 2,
      mySubmissions: [{ eraNumber: 2, roundNumber: null, window: 'PARADOX_RESOLUTION', choice: 'PASS', status: 'ACCEPTED' }],
    })
    const gameState = createGameStateSession({ state: paradoxState(), refresh: async () => accepted })
    const { result } = renderHookWithQueries(() => useParadoxResolution({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }))

    await waitFor(() => expect(result.current.view.kind).toBe('open'))
    act(() => result.current.choosePass())
    await act(async () => {
      await result.current.confirm()
    })

    expect(JSON.parse(String((fetchFn.mock.calls[0][1] as RequestInit).body))).toEqual({ actionType: 'PASS' })
    expect(result.current.rejection).toBeNull()
    expect(result.current.draft).toEqual({ kind: 'none' })
  })

  it('reports a pass rejected because the phase closed even though the refreshed state moved on', async () => {
    const fetchFn = server(async () => json({ code: '409-06', detail: 'phase closed' }, 409))
    const closed = paradoxState({ revision: 2, phase: 'RESOLUTION', phaseContext: { declarationOpen: false, paradoxOpen: false } })
    const gameState = createGameStateSession({ state: paradoxState(), refresh: async () => closed })
    const { result } = renderHookWithQueries(() => useParadoxResolution({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }))

    await waitFor(() => expect(result.current.view.kind).toBe('open'))
    act(() => result.current.choosePass())
    await act(async () => {
      await result.current.confirm()
    })

    expect(gameState.refresh).toHaveBeenCalledTimes(1)
    expect(result.current.rejection).toMatchObject({ code: '409-06', message: expect.stringMatching(/phase already closed/i) })
  })

  it('reports a pass rejected as already submitted even when game state records the earlier choice', async () => {
    const fetchFn = server(async () => json({ code: '409-07', detail: 'already submitted' }, 409))
    const accepted = paradoxState({
      revision: 2,
      mySubmissions: [{ eraNumber: 2, roundNumber: null, window: 'PARADOX_RESOLUTION', choice: 'CARD', status: 'ACCEPTED' }],
    })
    const gameState = createGameStateSession({ state: paradoxState(), refresh: async () => accepted })
    const { result } = renderHookWithQueries(() => useParadoxResolution({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }))

    await waitFor(() => expect(result.current.view.kind).toBe('open'))
    act(() => result.current.choosePass())
    await act(async () => {
      await result.current.confirm()
    })

    expect(result.current.rejection).toMatchObject({ code: '409-07' })
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('does not submit a card before its target is chosen', async () => {
    const fetchFn = server(async () => json({}))
    const gameState = createGameStateSession({ state: paradoxState() })
    const { result } = renderHookWithQueries(() => useParadoxResolution({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }))

    await waitFor(() => expect(result.current.view.kind).toBe('open'))
    act(() => result.current.selectCard(OFFER))
    await act(async () => {
      await result.current.confirm()
    })

    expect(fetchFn).not.toHaveBeenCalled()
  })

  it.each(['success', 'error'] as const)('ignores a late %s refresh after a later resolution phase opens', async (completion) => {
    const fetchFn = server(async () => {
      if (completion === 'error') throw new TypeError('response lost')
      return json({})
    })
    const refresh = deferred<GameStateView | null>()
    const firstPhase = createGameStateSession({ state: paradoxState(), refresh: () => refresh.promise })
    const laterPhase = createGameStateSession({
      state: paradoxState({
        revision: 3,
        eraNumber: 3,
        myEligibleResolutionCards: [{ cardInstanceId: NEXT_OFFER, cardType: 'STABILIZE', grade: 'I' }],
      }),
    })
    const { result, rerender } = renderHookWithQueries(
      ({ gameState }) => useParadoxResolution({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }),
      { initialProps: { gameState: firstPhase } },
    )

    await waitFor(() => expect(result.current.view.kind).toBe('open'))
    act(() => result.current.selectCard(OFFER))
    act(() => result.current.selectTarget(EVENT, OUTCOME))
    act(() => {
      void result.current.confirm()
    })
    await waitFor(() => expect(firstPhase.refresh).toHaveBeenCalledTimes(1))

    rerender({ gameState: laterPhase })
    act(() => result.current.selectCard(NEXT_OFFER))
    act(() => result.current.selectTarget(EVENT, OUTCOME))
    const nextDraft = { kind: 'card', cardInstanceId: NEXT_OFFER, target: { eventId: EVENT, outcomeId: OUTCOME } } as const
    expect(result.current.draft).toEqual(nextDraft)

    await act(async () => {
      refresh.resolve(
        paradoxState({
          revision: 2,
          mySubmissions: [{ eraNumber: 2, roundNumber: null, window: 'PARADOX_RESOLUTION', choice: 'CARD', status: 'ACCEPTED' }],
        }),
      )
      await refresh.promise
    })

    expect(result.current.view).toMatchObject({ kind: 'open', eraNumber: 3 })
    expect(result.current.draft).toEqual(nextDraft)
    expect(result.current.submitPhase).toEqual({ kind: 'idle' })
  })
})
