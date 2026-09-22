import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedFetchFn, GameStateView } from '../api/gameStateClient'
import { createGameStateSession } from '../game/gameStateTestSupport'
import { useResults } from './useResults'

function terminalStateBody(overrides: Record<string, unknown> = {}): GameStateView {
  const body = {
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
  return { ...body, raw: body } as unknown as GameStateView
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
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

const BASE = { apiBaseUrl: 'https://api.example.test' }

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useResults', () => {
  it('shows readiness while terminal awards are not yet complete', () => {
    const fetchFn = vi.fn() as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({ state: terminalStateBody({ result: null }) })
    const { result } = renderHook(() => useResults({ ...BASE, fetchFn, gameState, ownPlayerId: 'p-1', perspectiveKey: 'alice' }))

    expect(result.current.view.kind).toBe('waiting')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('shows every authoritative winner with final scores once complete', async () => {
    const fetchFn = fetchForTerminal()
    const gameState = createGameStateSession({ state: terminalStateBody() })
    const { result } = renderHook(() => useResults({ ...BASE, fetchFn, gameState, ownPlayerId: 'p-1', perspectiveKey: 'alice' }))
    await flush()

    expect(result.current.view.kind).toBe('complete')
    if (result.current.view.kind !== 'complete') {
      return
    }
    expect(result.current.view.winners.map((winner) => winner.playerId)).toEqual(['p-1', 'p-2'])
    expect(result.current.view.scores.find((entry) => entry.playerId === 'p-1')?.score).toBe(20)
  })

  it('does not expose the previous participant’s entitled data after a perspective switch', async () => {
    let scoresCalls = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input)
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
    const gameState = createGameStateSession({ state: terminalStateBody() })
    const { result, rerender } = renderHook(
      ({ perspectiveKey, ownPlayerId }: { perspectiveKey: string; ownPlayerId: string }) =>
        useResults({ ...BASE, fetchFn, gameState, ownPlayerId, perspectiveKey }),
      { initialProps: { perspectiveKey: 'alice', ownPlayerId: 'p-1' } },
    )
    await flush()
    expect(result.current.view.kind).toBe('complete')
    if (result.current.view.kind === 'complete') {
      expect(result.current.view.explanations).not.toHaveLength(0)
    }

    rerender({ perspectiveKey: 'bob', ownPlayerId: 'p-2' })
    await flush()

    // Bob's own entitled reads never landed: Alice's reasons must not carry over.
    if (result.current.view.kind === 'complete') {
      expect(result.current.view.explanations).toHaveLength(0)
    }
  })

  it('does not leave the refresh control stuck after the context changes mid-refresh', async () => {
    const hangingFetch = (async () => new Promise<Response>(() => {})) as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({ state: terminalStateBody() })
    const { result, rerender } = renderHook(
      ({ perspectiveKey, ownPlayerId }: { perspectiveKey: string; ownPlayerId: string }) =>
        useResults({ ...BASE, fetchFn: hangingFetch, gameState, ownPlayerId, perspectiveKey }),
      { initialProps: { perspectiveKey: 'alice', ownPlayerId: 'p-1' } },
    )
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
})
