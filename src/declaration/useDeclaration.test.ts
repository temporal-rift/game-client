import { act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedFetchFn, GameStateView } from '../api/projection'
import { createGameStateSession } from '../game/gameStateTestSupport'
import { gameStatePayload } from '../test/gameStatePayload'
import { renderHookWithQueries } from '../test/renderWithQueries'
import { uuid } from '../test/uuid'
import { useDeclaration } from './useDeclaration'

const GAME = uuid('game-1')
const EVENT = uuid('event-1')
const OUTCOME = uuid('outcome-1')

function declarationState(overrides: Partial<GameStateView> = {}): GameStateView {
  return gameStatePayload({
    gameId: GAME,
    revision: 1,
    phase: 'ERA_START',
    roundNumber: null,
    phaseContext: { declarationOpen: true, paradoxOpen: false },
    deadlines: { declarationExpiresAt: '2030-01-01T00:01:30Z' },
    myEligibleDeclarationModes: ['RALLY'],
    activeEvents: [
      { eventId: EVENT, title: 'Event', carryOverState: 'FRESH', outcomes: [{ outcomeId: OUTCOME, description: 'Outcome', initialProbability: 100 }] },
    ],
    ...overrides,
  })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function server(onSubmit: () => Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/declarations') && init?.method === 'POST') return onSubmit()
    throw new Error(`Unexpected API call: ${init?.method ?? 'GET'} ${url}`)
  }) as unknown as AuthenticatedFetchFn & ReturnType<typeof vi.fn>
}

async function selectAndConfirm(result: { current: ReturnType<typeof useDeclaration> }): Promise<void> {
  await waitFor(() => expect(result.current.view.kind).toBe('open'))
  act(() => result.current.selectMode('RALLY'))
  act(() => result.current.selectTarget(EVENT, OUTCOME))
  await act(async () => {
    await result.current.confirm()
  })
}

describe('useDeclaration', () => {
  it('uses projected eligibility and targets without calling a status endpoint', async () => {
    const fetchFn = server(async () => json({}))
    const gameState = createGameStateSession({ state: declarationState() })
    const { result } = renderHookWithQueries(() =>
      useDeclaration({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }),
    )

    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'open', eligibleModes: ['RALLY'] }))
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('sends the declared mode and exact event and outcome identifiers', async () => {
    const fetchFn = server(async () =>
      json({ gameId: GAME, eraNumber: 2, playerId: uuid('p1'), specialAction: 'RALLY', targetEventId: EVENT, targetOutcomeId: OUTCOME, status: 'DECLARED' }, 202),
    )
    const accepted = declarationState({
      revision: 2,
      mySubmissions: [{ eraNumber: 2, roundNumber: null, window: 'DECLARATION', status: 'ACCEPTED' }],
    })
    const gameState = createGameStateSession({ state: declarationState(), refresh: async () => accepted })
    const { result } = renderHookWithQueries(() =>
      useDeclaration({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }),
    )

    await selectAndConfirm(result)

    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ specialAction: 'RALLY', targetEventId: EVENT, targetOutcomeId: OUTCOME })
    expect(result.current.draft).toEqual({ kind: 'none' })
  })

  it('treats skip as a local dismissal with no submission', async () => {
    const fetchFn = server(async () => json({}))
    const gameState = createGameStateSession({ state: declarationState() })
    const { result } = renderHookWithQueries(() =>
      useDeclaration({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }),
    )

    await waitFor(() => expect(result.current.view.kind).toBe('open'))
    act(() => result.current.selectMode('RALLY'))
    act(() => result.current.skip())

    expect(result.current.submitPhase).toEqual({ kind: 'skipped' })
    expect(result.current.draft).toEqual({ kind: 'none' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('reconciles an accepted declaration after a lost response from game state only', async () => {
    const fetchFn = server(async () => {
      throw new TypeError('response lost')
    })
    const accepted = declarationState({
      revision: 2,
      mySubmissions: [{ eraNumber: 2, roundNumber: null, window: 'DECLARATION', status: 'ACCEPTED' }],
    })
    const gameState = createGameStateSession({ state: declarationState(), refresh: async () => accepted })
    const { result } = renderHookWithQueries(() =>
      useDeclaration({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }),
    )

    await selectAndConfirm(result)

    expect(result.current.submitPhase).toEqual({ kind: 'awaiting-projection' })
    expect(result.current.draft).toEqual({ kind: 'none' })
  })

  it('keeps the draft and reports a genuine rejection when game state has no accepted declaration', async () => {
    const fetchFn = server(async () => json({ code: '422-08', detail: 'not eligible' }, 422))
    const gameState = createGameStateSession({ state: declarationState(), refresh: async () => declarationState() })
    const { result } = renderHookWithQueries(() =>
      useDeclaration({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState }),
    )

    await selectAndConfirm(result)

    expect(result.current.submitPhase).toMatchObject({ kind: 'rejected', code: '422-08' })
    expect(result.current.draft).toEqual({ kind: 'declaration', mode: 'RALLY', targetEventId: EVENT, targetOutcomeId: OUTCOME })
  })
})
