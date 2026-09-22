import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEffectiveGameId } from './effectiveGameId'

describe('useEffectiveGameId', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('returns the active gameId and remembers it for this perspective', () => {
    const { result, rerender } = renderHook(
      ({ gameId }: { gameId: string | null }) => useEffectiveGameId(gameId, 'alice'),
      { initialProps: { gameId: 'game-1' as string | null } },
    )
    expect(result.current).toBe('game-1')

    // The lobby has no active game anymore (e.g. it ended), but the last one is remembered.
    rerender({ gameId: null })
    expect(result.current).toBe('game-1')
  })

  it('falls back to the stored game reference when no lobby game has loaded yet', () => {
    const first = renderHook(({ gameId }: { gameId: string | null }) => useEffectiveGameId(gameId, 'alice'), {
      initialProps: { gameId: 'game-1' as string | null },
    })
    expect(first.result.current).toBe('game-1')
    first.unmount()

    // A fresh mount (e.g. after a reload) with no lobby game loaded yet still
    // recovers the same game from the previous mount's stored reference.
    const second = renderHook(() => useEffectiveGameId(null, 'alice'))
    expect(second.result.current).toBe('game-1')
  })

  it('scopes the stored reference per perspective', () => {
    renderHook(({ gameId }: { gameId: string | null }) => useEffectiveGameId(gameId, 'alice'), {
      initialProps: { gameId: 'game-1' as string | null },
    })

    const bob = renderHook(() => useEffectiveGameId(null, 'bob'))
    expect(bob.result.current).toBeNull()
  })

  it('returns null when nothing is active and nothing is stored', () => {
    const { result } = renderHook(() => useEffectiveGameId(null, 'alice'))
    expect(result.current).toBeNull()
  })
})
