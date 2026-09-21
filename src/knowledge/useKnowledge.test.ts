import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedFetchFn } from '../api/gameStateClient'
import { useKnowledge } from './useKnowledge'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function stateBodyFor(playerName: string): Record<string, unknown> {
  return {
    gameId: 'game-1',
    eraNumber: 2,
    revision: 5,
    phase: 'ACTION_ROUND_2',
    roundNumber: 2,
    myScore: 4,
    players: [{ playerId: 'p-1', playerName, score: 8, isConnected: true, faction: null }],
    myRevealedIntel: [{ kind: 'INFLUENCE', observedInRound: 2, eventId: 'event-1', influencerPlayerIds: ['p-1'] }],
  }
}

async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
    await Promise.resolve()
    await Promise.resolve()
  })
}

const BASE = { apiBaseUrl: 'https://api.example.test', pollIntervalMs: 1000 }

describe('useKnowledge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reports unavailable before state loads, then derives bands and earned knowledge', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(stateBodyFor('Nora'))) as unknown as AuthenticatedFetchFn
    const { result } = renderHook(() => useKnowledge({ ...BASE, fetchFn, gameId: 'game-1', perspectiveKey: 'alice' }))

    expect(result.current.view.kind).toBe('unavailable')

    await flush()

    expect(result.current.view.kind).toBe('ready')
    if (result.current.view.kind !== 'ready') return
    expect(result.current.view.revealedKnowledge).toEqual([
      { kind: 'INFLUENCE', eventId: 'event-1', eventTitle: 'Event event-1', observedInRound: 2, expiresAtEraEnd: 2, influencerNames: ['Nora'] },
    ])
  })

  it('does not expose the previous perspective’s entitled knowledge after a perspective switch', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(stateBodyFor('Nora'))) as unknown as AuthenticatedFetchFn
    const { result, rerender } = renderHook(
      ({ perspectiveKey }: { perspectiveKey: string }) => useKnowledge({ ...BASE, fetchFn, gameId: 'game-1', perspectiveKey }),
      { initialProps: { perspectiveKey: 'alice' } },
    )
    await flush()
    expect(result.current.view.kind).toBe('ready')

    rerender({ perspectiveKey: 'bob' })

    // Before the new perspective's poll resolves, alice's already-reconciled
    // knowledge must not still be shown under bob's identity.
    expect(result.current.view.kind).toBe('unavailable')

    await flush()
    expect(result.current.view.kind).toBe('ready')
  })

  it('never regresses to an older, stale revision', async () => {
    let call = 0
    const fetchFn = vi.fn(async () => {
      call += 1
      // The second poll returns a lower revision than the first — a stale/duplicate delivery.
      return jsonResponse({ ...stateBodyFor('Nora'), revision: call === 1 ? 5 : 3 })
    }) as unknown as AuthenticatedFetchFn
    const { result } = renderHook(() => useKnowledge({ ...BASE, fetchFn, gameId: 'game-1', perspectiveKey: 'alice' }))
    await flush()
    expect(result.current.view.kind).toBe('ready')

    await flush(1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(result.current.view.kind).toBe('ready')
  })
})
