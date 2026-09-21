import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameState } from './useGameState'

function gameStateResponse(overrides: Record<string, unknown> = {}): Response {
  const body = {
    gameId: 'game-1',
    eraNumber: 1,
    phase: 'ACTION_ROUND_1',
    myScore: 0,
    ...overrides,
  }
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const BASE_OPTIONS = { apiBaseUrl: 'https://api.example.test', pollIntervalMs: 1000, maxPollIntervalMs: 8000 }

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value })
}

function setHidden(value: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, value })
}

/** Pumps the fake-timer microtask/macrotask queue so pending promise chains settle. */
async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
    // advanceTimersByTimeAsync(0) still needs an extra microtask turn for
    // chained .then()/await continuations (e.g. setState after a resolved fetch).
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useGameState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setOnline(true)
    setHidden(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts idle without a game and polls once one is set', async () => {
    const fetchFn = vi.fn().mockResolvedValue(gameStateResponse())
    const { result } = renderHook(() => useGameState({ ...BASE_OPTIONS, fetchFn, gameId: null, perspectiveKey: 'alice' }))
    expect(result.current.status.kind).toBe('idle')
    expect(fetchFn).not.toHaveBeenCalled()

    const { result: withGame } = renderHook(() =>
      useGameState({ ...BASE_OPTIONS, fetchFn, gameId: 'game-1', perspectiveKey: 'alice' }),
    )
    await flush()
    expect(withGame.current.status.kind).toBe('ready')
    expect(withGame.current.state?.gameId).toBe('game-1')
  })

  it('polls again after the configured interval', async () => {
    const fetchFn = vi.fn().mockResolvedValue(gameStateResponse({ revision: 1 }))
    renderHook(() => useGameState({ ...BASE_OPTIONS, fetchFn, gameId: 'game-1', perspectiveKey: 'alice' }))
    await flush()
    expect(fetchFn).toHaveBeenCalledTimes(1)

    await flush(1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('never regresses when a stale response arrives after a newer one', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    const fetchFn = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result } = renderHook(() => useGameState({ ...BASE_OPTIONS, fetchFn, gameId: 'game-1', perspectiveKey: 'alice' }))
    await flush()
    expect(fetchFn).toHaveBeenCalledTimes(1)

    // A forced refresh starts a second, independent request while the first is still in flight,
    // simulating a network layer that does not honor cancellation of the first request.
    act(() => {
      void result.current.refresh()
    })
    await flush()
    expect(fetchFn).toHaveBeenCalledTimes(2)

    // The newer request (revision 3) resolves first.
    second.resolve(gameStateResponse({ revision: 3 }))
    await flush()
    expect(result.current.state?.revision).toBe(3)

    // The older, delayed request (revision 2) resolves after it — must not regress.
    first.resolve(gameStateResponse({ revision: 2 }))
    await flush()
    expect(result.current.state?.revision).toBe(3)
    expect(result.current.status.kind).toBe('ready')
  })

  it('clears state on a perspective change and ignores a response from the old perspective', async () => {
    const alice = deferred<Response>()
    const bob = deferred<Response>()
    const fetchFn = vi.fn().mockReturnValueOnce(alice.promise).mockReturnValueOnce(bob.promise)

    const { result, rerender } = renderHook(
      (props: { perspectiveKey: string }) =>
        useGameState({ ...BASE_OPTIONS, fetchFn, gameId: 'game-1', perspectiveKey: props.perspectiveKey }),
      { initialProps: { perspectiveKey: 'alice' } },
    )
    await flush()
    expect(fetchFn).toHaveBeenCalledTimes(1)

    rerender({ perspectiveKey: 'bob' })
    expect(result.current.state).toBeNull()
    await flush()
    expect(fetchFn).toHaveBeenCalledTimes(2)

    bob.resolve(gameStateResponse({ revision: 1, myFaction: 'ACTIVISTS' }))
    await flush()
    expect(result.current.state?.myFaction).toBe('ACTIVISTS')

    // Alice's response, from the abandoned perspective, must never populate Bob's view.
    alice.resolve(gameStateResponse({ revision: 99, myFaction: 'ERASERS' }))
    await flush()
    expect(result.current.state?.myFaction).toBe('ACTIVISTS')
  })

  it('backs off on repeated failures and resets the interval once polling recovers', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValue(gameStateResponse({ revision: 1 }))

    const { result } = renderHook(() => useGameState({ ...BASE_OPTIONS, fetchFn, gameId: 'game-1', perspectiveKey: 'alice' }))
    await flush()
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(result.current.status.kind).toBe('failed')

    // Backoff doubled the delay to 2000ms: 1000ms alone must not trigger a retry yet.
    await flush(1000)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    await flush(1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(result.current.status.kind).toBe('failed')

    // Second failure doubles the delay again, to 4000ms.
    await flush(4000)
    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(result.current.status.kind).toBe('ready')

    // Success resets the delay back to the base interval (1000ms), not the 8000ms cap.
    await flush(1000)
    expect(fetchFn).toHaveBeenCalledTimes(4)
  })

  it('keeps the last known state visible while a poll is failing', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(gameStateResponse({ revision: 1 }))
      .mockRejectedValueOnce(new TypeError('network down'))

    const { result } = renderHook(() => useGameState({ ...BASE_OPTIONS, fetchFn, gameId: 'game-1', perspectiveKey: 'alice' }))
    await flush()
    expect(result.current.status.kind).toBe('ready')

    await flush(1000)
    expect(result.current.status.kind).toBe('stalled')
    expect(result.current.state?.revision).toBe(1)
  })

  it('pauses polling while offline or backgrounded and resumes immediately once connectivity/visibility return', async () => {
    const fetchFn = vi.fn().mockResolvedValue(gameStateResponse({ revision: 1 }))
    renderHook(() => useGameState({ ...BASE_OPTIONS, fetchFn, gameId: 'game-1', perspectiveKey: 'alice' }))
    await flush()
    expect(fetchFn).toHaveBeenCalledTimes(1)

    setOnline(false)
    await flush(1000)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    setOnline(true)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    await flush()
    expect(fetchFn).toHaveBeenCalledTimes(2)

    setHidden(true)
    await flush(1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    setHidden(false)
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await flush()
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })

  it('stops polling after unmount even when a request was in flight at the time', async () => {
    const inFlight = deferred<Response>()
    const fetchFn = vi.fn().mockReturnValueOnce(inFlight.promise).mockResolvedValue(gameStateResponse({ revision: 1 }))

    const { unmount } = renderHook(() => useGameState({ ...BASE_OPTIONS, fetchFn, gameId: 'game-1', perspectiveKey: 'alice' }))
    await flush()
    expect(fetchFn).toHaveBeenCalledTimes(1)

    unmount()

    // The in-flight request settles after unmount, as if cancellation raced a response already on the wire.
    inFlight.resolve(gameStateResponse({ revision: 1 }))
    await flush()

    // A zombie loop would reschedule and fetch again once the base interval elapses; it must not.
    await flush(8000)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('recovers own accepted submissions for lost-response retry safety', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      gameStateResponse({
        revision: 1,
        mySubmissions: [{ eraNumber: 1, roundNumber: 1, kind: 'ACTION', status: 'ACCEPTED', actionType: 'CARD' }],
      }),
    )
    const { result } = renderHook(() => useGameState({ ...BASE_OPTIONS, fetchFn, gameId: 'game-1', perspectiveKey: 'alice' }))
    await flush()
    expect(result.current.status.kind).toBe('ready')

    expect(result.current.hasAcceptedSubmission({ eraNumber: 1, kind: 'ACTION', roundNumber: 1 })).toBe(true)
    expect(result.current.hasAcceptedSubmission({ eraNumber: 1, kind: 'ACTION', roundNumber: 2 })).toBe(false)
  })
})
