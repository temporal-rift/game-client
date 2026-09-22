import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedFetchFn, GameStateView } from '../api/gameStateClient'
import { createGameStateSession } from '../game/gameStateTestSupport'
import { useHandSelection } from './useHandSelection'

function stateBody(overrides: Record<string, unknown> = {}): GameStateView {
  const body = {
    gameId: 'game-1', eraNumber: 2, revision: 1, phase: 'HAND_SELECTION', mySubmissions: [],
    pendingHandSelection: {
      cards: Array.from({ length: 7 }, (_, index) => ({ cardInstanceId: `card-${index + 1}`, cardType: 'PUSH', grade: 'II', dealSlot: index + 1 })),
      requiredSelectionCount: 5, expiresAt: '2026-10-01T12:00:00Z',
    },
    ...overrides,
  }
  return { ...body, raw: body } as unknown as GameStateView
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('useHandSelection', () => {
  it('keeps five distinct offered cards and refreshes after acceptance', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ gameId: 'game-1', eraNumber: 2, playerId: 'me', status: 'SELECTED' })) as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({ state: stateBody() })
    const { result } = renderHook(() => useHandSelection({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }))

    act(() => ['card-1', 'card-2', 'card-3', 'card-4', 'card-5'].forEach(result.current.toggleCard))
    expect(result.current.selectedCardInstanceIds).toEqual(['card-1', 'card-2', 'card-3', 'card-4', 'card-5'])
    act(() => result.current.toggleCard('card-6'))
    expect(result.current.selectedCardInstanceIds).toHaveLength(5)

    await act(async () => { await result.current.confirm() })

    expect(JSON.parse((fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).toEqual({
      keptCardInstanceIds: ['card-1', 'card-2', 'card-3', 'card-4', 'card-5'],
    })
    expect(result.current.submitPhase).toEqual({ kind: 'submitted' })
    expect(gameState.refresh).toHaveBeenCalledTimes(1)
  })

  it('recovers an accepted keep after a lost response instead of allowing a second submission', async () => {
    const fetchFn = vi.fn(async () => { throw new TypeError('network down') }) as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({
      state: stateBody(),
      refresh: async () => stateBody({ mySubmissions: [{ eraNumber: 2, roundNumber: null, kind: 'HAND_SELECTION', status: 'ACCEPTED' }] }),
    })
    const { result } = renderHook(() => useHandSelection({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }))
    act(() => ['card-1', 'card-2', 'card-3', 'card-4', 'card-5'].forEach(result.current.toggleCard))

    await act(async () => { await result.current.confirm() })

    expect(result.current.submitPhase).toEqual({ kind: 'submitted' })
    expect(result.current.selectedCardInstanceIds).toEqual([])
  })

  it('keeps the draft on a genuine authoritative rejection', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ code: '422-11', detail: 'bad cards' }, 422)) as unknown as AuthenticatedFetchFn
    const gameState = createGameStateSession({ state: stateBody(), refresh: async () => stateBody() })
    const { result } = renderHook(() => useHandSelection({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }))
    act(() => ['card-1', 'card-2', 'card-3', 'card-4', 'card-5'].forEach(result.current.toggleCard))

    await act(async () => { await result.current.confirm() })

    expect(result.current.submitPhase).toMatchObject({ kind: 'rejected', code: '422-11' })
    expect(result.current.selectedCardInstanceIds).toHaveLength(5)
  })

  it('ignores a completion from an offer that a newer authoritative offer replaced', async () => {
    let resolveSubmission: (() => void) | undefined
    const fetchFn = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveSubmission = () => resolve(jsonResponse({ gameId: 'game-1', eraNumber: 2, playerId: 'me', status: 'SELECTED' }))
        }),
    ) as unknown as AuthenticatedFetchFn
    const firstGameState = createGameStateSession({ state: stateBody() })
    const secondGameState = createGameStateSession({
      state: stateBody({
        pendingHandSelection: {
          cards: Array.from({ length: 7 }, (_, index) => ({ cardInstanceId: `replacement-${index + 1}`, cardType: 'SCAN', grade: 'I', dealSlot: index + 1 })),
          requiredSelectionCount: 5,
          expiresAt: '2026-10-01T12:00:00Z',
        },
      }),
    })
    const { result, rerender } = renderHook(
      ({ gameState }) => useHandSelection({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }),
      { initialProps: { gameState: firstGameState } },
    )
    act(() => ['card-1', 'card-2', 'card-3', 'card-4', 'card-5'].forEach(result.current.toggleCard))
    const confirmation = result.current.confirm()

    await act(async () => {
      rerender({ gameState: secondGameState })
    })
    resolveSubmission?.()
    await act(async () => {
      await confirmation
    })

    expect(result.current.submitPhase).toEqual({ kind: 'idle' })
    expect(firstGameState.refresh).not.toHaveBeenCalled()
  })
})
