import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedFetchFn } from '../api/gameStateClient'
import { useResults } from './useResults'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function terminalStateBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    gameId: 'game-1',
    eraNumber: 3,
    revision: 41,
    phase: 'GAME_ENDED',
    myScore: 12,
    myFaction: 'WEAVERS',
    players: [
      { playerId: 'p-1', playerName: 'Nora', score: 20, faction: 'PROPHETS' },
      { playerId: 'p-2', playerName: 'Eli', score: 20, faction: 'ERASERS' },
    ],
    result: {
      endReason: 'SCORE_THRESHOLD',
      winners: [
        { playerId: 'p-1', faction: 'PROPHETS' },
        { playerId: 'p-2', faction: 'ERASERS' },
      ],
      finalScores: [
        { playerId: 'p-1', score: 20 },
        { playerId: 'p-2', score: 20 },
      ],
      revealBoundary: 'FACTIONS_AND_SCORES_PUBLIC',
    },
    ...overrides,
  }
}

function scoresBody(): Record<string, unknown> {
  return {
    gameId: 'game-1',
    eraNumber: 3,
    scores: [
      { playerId: 'p-1', playerName: 'Nora', score: 20, faction: 'PROPHETS' },
      { playerId: 'p-2', playerName: 'Eli', score: 20, faction: 'ERASERS' },
    ],
  }
}

function historyBody(): Record<string, unknown> {
  return {
    gameId: 'game-1',
    history: [{ eraNumber: 1, deltas: [{ playerId: 'p-1', pointsDelta: 4, reason: 'EVENT_RESOLVED_AS_WRITTEN' }] }],
  }
}

function fetchForTerminal(): AuthenticatedFetchFn {
  const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    if (url.endsWith('/state')) {
      return jsonResponse(terminalStateBody())
    }
    if (url.endsWith('/scores/history')) {
      return jsonResponse(historyBody())
    }
    if (url.endsWith('/scores')) {
      return jsonResponse(scoresBody())
    }
    throw new Error(`unexpected url ${url}`)
  })
  return fetchMock as unknown as AuthenticatedFetchFn
}

async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
    await Promise.resolve()
    await Promise.resolve()
  })
}

const BASE = { apiBaseUrl: 'https://api.example.test', pollIntervalMs: 1000 }

describe('useResults', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('shows readiness while terminal awards are not yet complete', async () => {
    const rawMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input)
      if (url.endsWith('/state')) {
        return jsonResponse(terminalStateBody({ result: null }))
      }
      throw new Error(`unexpected url ${url}`)
    })
    const fetchFn = rawMock as unknown as AuthenticatedFetchFn
    const { result } = renderHook(() =>
      useResults({ ...BASE, fetchFn, gameId: 'game-1', ownPlayerId: 'p-1', perspectiveKey: 'alice' }),
    )
    await flush()

    expect(result.current.view.kind).toBe('waiting')
    expect(rawMock.mock.calls.some((call) => String(call[0]).endsWith('/scores'))).toBe(false)
  })

  it('shows every authoritative winner with final scores once complete', async () => {
    const fetchFn = fetchForTerminal()
    const { result } = renderHook(() =>
      useResults({ ...BASE, fetchFn, gameId: 'game-1', ownPlayerId: 'p-1', perspectiveKey: 'alice' }),
    )
    await flush()
    await flush()

    expect(result.current.view.kind).toBe('complete')
    if (result.current.view.kind !== 'complete') {
      return
    }
    expect(result.current.view.winners.map((winner) => winner.playerId)).toEqual(['p-1', 'p-2'])
    expect(result.current.view.scores.find((entry) => entry.playerId === 'p-1')?.score).toBe(20)
  })

  it('recovers the same winner set and totals after reload', async () => {
    const firstFetch = fetchForTerminal()
    const first = renderHook(() =>
      useResults({ ...BASE, fetchFn: firstFetch, gameId: 'game-1', ownPlayerId: 'p-1', perspectiveKey: 'alice' }),
    )
    await flush()
    await flush()
    expect(first.result.current.view.kind).toBe('complete')
    first.unmount()

    const secondFetch = fetchForTerminal()
    const second = renderHook(() =>
      useResults({ ...BASE, fetchFn: secondFetch, gameId: 'game-1', ownPlayerId: 'p-1', perspectiveKey: 'alice' }),
    )
    await flush()
    await flush()

    expect(second.result.current.view.kind).toBe('complete')
    if (second.result.current.view.kind !== 'complete' || first.result.current.view.kind !== 'complete') {
      return
    }
    expect(second.result.current.view.winners).toEqual(first.result.current.view.winners)
    expect(second.result.current.view.scores).toEqual(first.result.current.view.scores)
  })

  it('does not expose the previous participant’s entitled data after a perspective switch', async () => {
    let scoresCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input)
      if (url.endsWith('/state')) {
        return jsonResponse(terminalStateBody())
      }
      if (url.endsWith('/scores') || url.endsWith('/scores/history')) {
        scoresCalls += 1
        // Alice's first read resolves; every later participant-scoped read hangs.
        if (scoresCalls <= 2) {
          return jsonResponse(url.endsWith('/scores/history') ? historyBody() : scoresBody())
        }
        return new Promise<Response>(() => {})
      }
      throw new Error(`unexpected url ${url}`)
    })
    const fetchFn = fetchMock as unknown as AuthenticatedFetchFn
    const { result, rerender } = renderHook(
      ({ perspectiveKey, ownPlayerId }: { perspectiveKey: string; ownPlayerId: string }) =>
        useResults({ ...BASE, fetchFn, gameId: 'game-1', ownPlayerId, perspectiveKey }),
      { initialProps: { perspectiveKey: 'alice', ownPlayerId: 'p-1' } },
    )
    await flush()
    await flush()
    expect(result.current.view.kind).toBe('complete')
    if (result.current.view.kind === 'complete') {
      expect(result.current.view.explanations).not.toHaveLength(0)
    }

    rerender({ perspectiveKey: 'bob', ownPlayerId: 'p-2' })
    await flush()
    await flush()

    // Bob's own entitled reads never landed: Alice's reasons must not carry over.
    if (result.current.view.kind === 'complete') {
      expect(result.current.view.explanations).toHaveLength(0)
    }
  })

  it('does not leave the refresh control stuck after the context changes mid-refresh', async () => {
    const hangingFetch = (async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input)
      if (url.endsWith('/state')) {
        return jsonResponse(terminalStateBody())
      }
      return new Promise<Response>(() => {})
    }) as unknown as AuthenticatedFetchFn
    const { result, rerender } = renderHook(
      ({ perspectiveKey, ownPlayerId }: { perspectiveKey: string; ownPlayerId: string }) =>
        useResults({ ...BASE, fetchFn: hangingFetch, gameId: 'game-1', ownPlayerId, perspectiveKey }),
      { initialProps: { perspectiveKey: 'alice', ownPlayerId: 'p-1' } },
    )
    await flush()
    await flush()

    act(() => {
      void result.current.refresh()
    })
    await flush()
    expect(result.current.isRefreshing).toBe(true)

    rerender({ perspectiveKey: 'bob', ownPlayerId: 'p-2' })
    await flush()

    expect(result.current.isRefreshing).toBe(false)
  })

  it('falls back to the stored game reference when the lobby has not loaded yet', async () => {
    const firstFetch = fetchForTerminal()
    const first = renderHook(() =>
      useResults({ ...BASE, fetchFn: firstFetch, gameId: 'game-1', ownPlayerId: 'p-1', perspectiveKey: 'alice' }),
    )
    await flush()
    await flush()
    expect(first.result.current.view.kind).toBe('complete')
    first.unmount()

    const secondFetch = fetchForTerminal()
    const second = renderHook(() =>
      useResults({ ...BASE, fetchFn: secondFetch, gameId: null, ownPlayerId: 'p-1', perspectiveKey: 'alice' }),
    )
    await flush()
    await flush()

    expect(second.result.current.view.kind).toBe('complete')
    if (second.result.current.view.kind !== 'complete') {
      return
    }
    expect(second.result.current.view.winners.map((winner) => winner.playerId)).toEqual(['p-1', 'p-2'])
  })
})
