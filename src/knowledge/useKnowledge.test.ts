import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GameStateView } from '../api/gameStateClient'
import { createGameStateSession } from '../game/gameStateTestSupport'
import { useKnowledge } from './useKnowledge'

function stateBodyFor(playerName: string): GameStateView {
  const body = {
    gameId: 'game-1',
    eraNumber: 2,
    revision: 5,
    phase: 'ACTION_ROUND_2',
    roundNumber: 2,
    myScore: 4,
    players: [{ playerId: 'p-1', playerName, score: 8, isConnected: true, faction: null }],
    myRevealedIntel: [{ kind: 'INFLUENCE', observedInRound: 2, eventId: 'event-1', influencerPlayerIds: ['p-1'] }],
  }
  return { ...body, raw: body } as unknown as GameStateView
}

describe('useKnowledge', () => {
  it('reports unavailable before state is available', () => {
    const gameState = createGameStateSession({ state: null, status: { kind: 'loading' } })
    const { result } = renderHook(() => useKnowledge({ gameState }))

    expect(result.current.view.kind).toBe('unavailable')
  })

  it('derives bands and earned knowledge once state resolves', () => {
    const gameState = createGameStateSession({ state: stateBodyFor('Nora') })
    const { result } = renderHook(() => useKnowledge({ gameState }))

    expect(result.current.view.kind).toBe('ready')
    if (result.current.view.kind !== 'ready') return
    expect(result.current.view.revealedKnowledge).toEqual([
      { kind: 'INFLUENCE', eventId: 'event-1', eventTitle: 'Event event-1', observedInRound: 2, expiresAtEraEnd: 2, influencerNames: ['Nora'] },
    ])
  })

  it('reflects the shared session status, including stalled/failed', () => {
    const gameState = createGameStateSession({
      state: stateBodyFor('Nora'),
      status: { kind: 'stalled', message: 'network down', code: null },
    })
    const { result } = renderHook(() => useKnowledge({ gameState }))

    expect(result.current.status).toBe('stalled')
    expect(result.current.message).toBe('network down')
    // Entitled knowledge already reconciled stays visible while merely stalled.
    expect(result.current.view.kind).toBe('ready')
  })

  it('delegates refresh to the shared session', async () => {
    const gameState = createGameStateSession({ state: stateBodyFor('Nora') })
    const { result } = renderHook(() => useKnowledge({ gameState }))

    await act(async () => {
      await result.current.refresh()
    })

    expect(gameState.refresh).toHaveBeenCalledTimes(1)
  })
})
