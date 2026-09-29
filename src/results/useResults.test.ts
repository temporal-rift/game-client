import { act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedFetchFn, GameStateView } from '../api/projection'
import { createGameStateSession } from '../game/gameStateTestSupport'
import { gameStatePayload } from '../test/gameStatePayload'
import { renderHookWithQueries } from '../test/renderWithQueries'
import { uuid } from '../test/uuid'
import { useResults } from './useResults'

const GAME = uuid('game-1')
const P1 = uuid('p-1')
const P2 = uuid('p-2')

function terminalStateBody(overrides: Partial<GameStateView> = {}): GameStateView {
  return gameStatePayload({
    gameId: GAME,
    eraNumber: 3,
    revision: 41,
    phase: 'GAME_ENDED',
    myScore: 12,
    myFaction: 'WEAVERS',
    players: [
      { playerId: P1, playerName: 'Nora', score: 20, isConnected: true, faction: 'PROPHETS' },
      { playerId: P2, playerName: 'Eli', score: 20, isConnected: true, faction: 'ERASERS' },
    ],
    result: {
      endReason: 'WIN_CONDITION_MET',
      winners: [
        { playerId: P1, faction: 'PROPHETS', winType: 'SCORE_THRESHOLD' },
        { playerId: P2, faction: 'ERASERS', winType: 'SCORE_THRESHOLD' },
      ],
      finalScores: [
        { playerId: P1, score: 20 },
        { playerId: P2, score: 20 },
      ],
      revealBoundary: 'FACTIONS_AND_SCORES_PUBLIC',
    },
    ...overrides,
  })
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function scoresBody(): Record<string, unknown> {
  return {
    gameId: GAME,
    eraNumber: 3,
    scores: [
      { playerId: P1, playerName: 'Nora', score: 20, faction: 'PROPHETS' },
      { playerId: P2, playerName: 'Eli', score: 20, faction: 'ERASERS' },
    ],
  }
}

function historyBody(): Record<string, unknown> {
  return {
    gameId: GAME,
    history: [{ eraNumber: 1, deltas: [{ playerId: P1, pointsDelta: 4, reason: 'EVENT_RESOLVED_AS_WRITTEN' }] }],
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

/** Settles pending reads, including the query cache's batched (0ms timer) notification. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
}

describe('useResults', () => {
  it('shows readiness while terminal awards are not yet complete', () => {
    const fetchFn = vi.fn() as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({ state: terminalStateBody({ result: undefined }) })
    const { result } = renderHookWithQueries(() => useResults({ ...BASE, fetchFn, gameState, ownPlayerId: P1, perspectiveKey: 'alice' }))

    expect(result.current.view.kind).toBe('waiting')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('shows every authoritative winner with final scores once complete', async () => {
    const fetchFn = fetchForTerminal()
    const gameState = createGameStateSession({ state: terminalStateBody() })
    const { result } = renderHookWithQueries(() => useResults({ ...BASE, fetchFn, gameState, ownPlayerId: P1, perspectiveKey: 'alice' }))
    // Scores and history arrive on their own reads; wait for both rather than a fixed delay.
    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'complete', explanations: [expect.anything()] }))

    expect(result.current.view.kind).toBe('complete')
    if (result.current.view.kind !== 'complete') {
      return
    }
    expect(result.current.view.winners.map((winner) => winner.playerId)).toEqual([P1, P2])
    expect(result.current.view.scores.find((entry) => entry.playerId === P1)?.score).toBe(20)
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
    const { result, rerender } = renderHookWithQueries(
      ({ perspectiveKey, ownPlayerId }: { perspectiveKey: string; ownPlayerId: string }) =>
        useResults({ ...BASE, fetchFn, gameState, ownPlayerId, perspectiveKey }),
      { initialProps: { perspectiveKey: 'alice', ownPlayerId: P1 } },
    )
    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'complete', explanations: [expect.anything()] }))

    rerender({ perspectiveKey: 'bob', ownPlayerId: P2 })
    await flush()

    // Bob's own entitled reads never landed: Alice's reasons must not carry over.
    if (result.current.view.kind === 'complete') {
      expect(result.current.view.explanations).toHaveLength(0)
    }
  })

  it('does not leave the refresh control stuck after the context changes mid-refresh', async () => {
    const hangingFetch = (async () => new Promise<Response>(() => {})) as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({ state: terminalStateBody() })
    const { result, rerender } = renderHookWithQueries(
      ({ perspectiveKey, ownPlayerId }: { perspectiveKey: string; ownPlayerId: string }) =>
        useResults({ ...BASE, fetchFn: hangingFetch, gameState, ownPlayerId, perspectiveKey }),
      { initialProps: { perspectiveKey: 'alice', ownPlayerId: P1 } },
    )
    await flush()

    act(() => {
      void result.current.refresh()
    })
    await waitFor(() => expect(result.current.isRefreshing).toBe(true))

    rerender({ perspectiveKey: 'bob', ownPlayerId: P2 })
    await flush()

    expect(result.current.isRefreshing).toBe(false)
  })
})
