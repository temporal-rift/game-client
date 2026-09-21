import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useActionSubmission } from './useActionSubmission'

function stateBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
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
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problemResponse(status: number, code: string): Response {
  return new Response(JSON.stringify({ code, detail: 'rejected' }), { status, headers: { 'Content-Type': 'application/problem+json' } })
}

async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
    await Promise.resolve()
    await Promise.resolve()
  })
}

const BASE_OPTIONS = { apiBaseUrl: 'https://api.example.test', gameId: 'game-1', ownPlayerId: 'me', perspectiveKey: 'me' }

describe('useActionSubmission', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('submits a selected card with its coordinates and clears the draft on acceptance', async () => {
    let submissionsAfterSubmit: unknown[] = []
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        submissionsAfterSubmit = [{ eraNumber: 2, roundNumber: 1, kind: 'ACTION', actionType: 'CARD' }]
        return jsonResponse({ gameId: 'game-1', eraNumber: 2, roundNumber: 1, playerId: 'me', status: 'SUBMITTED', roundClosed: false })
      }
      return jsonResponse(stateBody({ revision: 1, mySubmissions: submissionsAfterSubmit }))
    })

    const { result } = renderHook(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn }))
    await flush()

    act(() => result.current.selectCard('card-1', { targetEventId: 'evt-1', targetOutcomeId: 'out-1' }))
    expect(result.current.draft).toEqual({ kind: 'card', cardInstanceId: 'card-1', coordinates: { targetEventId: 'evt-1', targetOutcomeId: 'out-1' } })

    await act(async () => {
      await result.current.confirm()
    })
    await flush()

    expect(result.current.submitPhase).toEqual({ kind: 'submitted' })
    expect(result.current.draft).toEqual({ kind: 'none' })
    const postCall = fetchFn.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    if (!postCall) throw new Error('expected a POST call')
    expect(JSON.parse((postCall[1] as RequestInit).body as string)).toEqual({
      actionType: 'CARD',
      cardInstanceId: 'card-1',
      targetEventId: 'evt-1',
      targetOutcomeId: 'out-1',
    })
  })

  it('recovers acceptance after a lost response instead of reporting failure', async () => {
    let submitCalls = 0
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        submitCalls += 1
        throw new TypeError('network down')
      }
      // The GET refresh after the failed POST reveals the action actually landed.
      const landed = submitCalls > 0
      return jsonResponse(
        stateBody({ revision: submitCalls + 1, mySubmissions: landed ? [{ eraNumber: 2, roundNumber: 1, kind: 'ACTION', actionType: 'CARD' }] : [] }),
      )
    })

    const { result } = renderHook(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn }))
    await flush()

    act(() => result.current.selectCard('card-1', { targetEventId: 'evt-1', targetOutcomeId: 'out-1' }))
    await act(async () => {
      await result.current.confirm()
    })
    await flush()

    expect(result.current.submitPhase).toEqual({ kind: 'submitted' })
    expect(result.current.draft).toEqual({ kind: 'none' })
  })

  it('preserves the draft and reports a rejection when the action is genuinely invalid', async () => {
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return problemResponse(422, '422-03')
      }
      return jsonResponse(stateBody({ revision: 1, mySubmissions: [] }))
    })

    const { result } = renderHook(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn }))
    await flush()

    act(() => result.current.selectCard('card-1', { targetEventId: 'evt-1', targetOutcomeId: 'out-1' }))
    await act(async () => {
      await result.current.confirm()
    })
    await flush()

    expect(result.current.submitPhase).toMatchObject({ kind: 'rejected', code: '422-03' })
    expect(result.current.draft).toEqual({ kind: 'card', cardInstanceId: 'card-1', coordinates: { targetEventId: 'evt-1', targetOutcomeId: 'out-1' } })
  })

  it('clears a stale draft once the round already shows an accepted submission', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(stateBody({ revision: 1, mySubmissions: [{ eraNumber: 2, roundNumber: 1, kind: 'ACTION', actionType: 'CARD' }] })))
    const { result } = renderHook(() => useActionSubmission({ ...BASE_OPTIONS, fetchFn }))
    await flush()

    expect(result.current.view.kind).toBe('open')
    if (result.current.view.kind === 'open') {
      expect(result.current.view.hasSubmitted).toBe(true)
    }
    expect(result.current.draft).toEqual({ kind: 'none' })
  })
})
