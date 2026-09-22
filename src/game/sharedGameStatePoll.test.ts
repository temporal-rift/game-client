import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useActionSubmission } from '../action/useActionSubmission'
import { useKnowledge } from '../knowledge/useKnowledge'
import { useGameState } from './useGameState'

function gameStateResponse(overrides: Record<string, unknown> = {}): Response {
  const body = {
    gameId: 'game-1',
    eraNumber: 1,
    phase: 'ACTION_ROUND_1',
    roundNumber: 1,
    myScore: 0,
    myHand: [],
    mySpecialActions: [],
    mySubmissions: [],
    ...overrides,
  }
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
    await Promise.resolve()
    await Promise.resolve()
  })
}

const BASE_OPTIONS = { apiBaseUrl: 'https://api.example.test', pollIntervalMs: 1000, maxPollIntervalMs: 8000 }

/**
 * Exercises the shared subscription the way App.tsx wires it: one
 * `useGameState` call feeding multiple feature hooks, verifying the
 * consolidation this change makes structurally guaranteed rather than
 * merely coincidental.
 */
function useSharedConsumers(perspectiveKey: string, fetchFn: ReturnType<typeof vi.fn>) {
  const gameState = useGameState({ ...BASE_OPTIONS, fetchFn: fetchFn as never, gameId: 'game-1', perspectiveKey })
  const knowledge = useKnowledge({ gameState })
  const action = useActionSubmission({ apiBaseUrl: BASE_OPTIONS.apiBaseUrl, fetchFn: fetchFn as never, gameState, ownPlayerId: 'p-1' })
  return { gameState, knowledge, action }
}

describe('shared game-state poll across multiple consumers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('issues exactly one HTTP request per poll interval regardless of consumer count', async () => {
    const fetchFn = vi.fn().mockResolvedValue(gameStateResponse({ revision: 1 }))
    renderHook(() => useSharedConsumers('alice', fetchFn))
    await flush()
    expect(fetchFn).toHaveBeenCalledTimes(1)

    await flush(1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('derives every consumer’s view from the same revision within the same render', async () => {
    const fetchFn = vi.fn().mockResolvedValue(gameStateResponse({ revision: 7, phase: 'ACTION_ROUND_1' }))
    const { result } = renderHook(() => useSharedConsumers('alice', fetchFn))
    await flush()

    expect(result.current.gameState.state?.revision).toBe(7)
    expect(result.current.action.view.kind).toBe('open')
    if (result.current.action.view.kind === 'open') {
      expect(result.current.action.view.eraNumber).toBe(1)
    }
    // Knowledge derives from the same resolved state object as action's view.
    expect(result.current.knowledge.status).toBe('ready')
  })

  it('reflects a stalled poll identically across every consumer', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(gameStateResponse({ revision: 1 }))
      .mockRejectedValueOnce(new TypeError('network down'))
    const { result } = renderHook(() => useSharedConsumers('alice', fetchFn))
    await flush()
    expect(result.current.knowledge.status).toBe('ready')

    await flush(1000)
    expect(result.current.gameState.status.kind).toBe('stalled')
    expect(result.current.knowledge.status).toBe('stalled')
  })

  it('resets every consumer atomically on a perspective switch', async () => {
    const fetchFn = vi.fn().mockResolvedValue(gameStateResponse({ revision: 1, myFaction: 'ACTIVISTS' }))
    const { result, rerender } = renderHook(
      ({ perspectiveKey }: { perspectiveKey: string }) => useSharedConsumers(perspectiveKey, fetchFn),
      { initialProps: { perspectiveKey: 'alice' } },
    )
    await flush()
    expect(result.current.knowledge.status).toBe('ready')

    rerender({ perspectiveKey: 'bob' })

    // Both consumers must already reflect the reset in this same render, before bob's poll resolves.
    expect(result.current.gameState.state).toBeNull()
    expect(result.current.knowledge.view.kind).toBe('unavailable')
    expect(result.current.action.view.kind).toBe('unavailable')
  })
})
