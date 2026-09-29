import { act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedFetchFn, GameStateView } from '../api/projection'
import { createGameStateSession } from '../game/gameStateTestSupport'
import { gameStatePayload } from '../test/gameStatePayload'
import { renderHookWithQueries } from '../test/renderWithQueries'
import { uuid } from '../test/uuid'
import { useParadoxResolution } from './useParadoxResolution'

const GAME = uuid('game-1')
const OFFER = uuid('offer-1')
const EVENT = uuid('event-1')
const OUTCOME = uuid('outcome-1')

function paradoxState(overrides: Partial<GameStateView> = {}): GameStateView {
  return gameStatePayload({
    gameId: GAME,
    revision: 1,
    phase: 'PARADOX_RESOLUTION',
    phaseContext: { declarationOpen: false, paradoxOpen: true },
    activeEvents: [{ eventId: EVENT, title: 'Event', carryOverState: 'FRESH', outcomes: [{ outcomeId: OUTCOME, description: 'Outcome', initialProbability: 100 }] }],
    ...overrides,
  })
}

function statusBody(mySubmitted: boolean) {
  return {
    eraNumber: 2,
    phaseOpen: true,
    submittedCount: mySubmitted ? 1 : 0,
    totalPlayers: 3,
    mySubmitted,
    affectedEventIds: [EVENT],
    eligibleResolutionCards: mySubmitted ? [] : [{ cardInstanceId: OFFER, cardType: 'STABILIZE', grade: 'I' }],
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * Serves the phase status; the card submission answers with `onSubmit`, and
 * `lands` says whether the server accepted it whatever the answer was.
 */
function server(onSubmit: () => Promise<Response>, lands: boolean) {
  let submitted = false
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/paradox-resolution/actions') && init?.method === 'POST') {
      return onSubmit().finally(() => {
        submitted = true
      })
    }
    return json(statusBody(submitted && lands))
  })
  return fetchFn as unknown as AuthenticatedFetchFn
}

async function selectAndConfirm(result: { current: ReturnType<typeof useParadoxResolution> }): Promise<void> {
  await waitFor(() => expect(result.current.view.kind).toBe('open'))
  act(() => result.current.selectCard(OFFER))
  act(() => result.current.selectTarget(EVENT, OUTCOME))
  await act(async () => {
    await result.current.confirm()
  })
}

describe('useParadoxResolution', () => {
  it('offers only the status-provided cards and affected events of the open phase', async () => {
    const gameState = createGameStateSession({ state: paradoxState() })
    const { result } = renderHookWithQueries(() =>
      useParadoxResolution({ apiBaseUrl: 'https://api.example.test', fetchFn: server(async () => json({}), false), gameState, perspectiveKey: 'me' }),
    )

    await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'open', cards: [{ cardInstanceId: OFFER }] }))
  })

  it('recovers an accepted choice after a lost response instead of reporting failure', async () => {
    const lost = async (): Promise<Response> => {
      throw new TypeError('response lost')
    }
    const gameState = createGameStateSession({ state: paradoxState(), refresh: async () => paradoxState({ revision: 2 }) })
    const { result } = renderHookWithQueries(() =>
      useParadoxResolution({ apiBaseUrl: 'https://api.example.test', fetchFn: server(lost, true), gameState, perspectiveKey: 'me' }),
    )

    await selectAndConfirm(result)

    expect(result.current.submitPhase).toEqual({ kind: 'submitted' })
    expect(result.current.draft).toEqual({ kind: 'none' })
  })

  it('keeps the draft and reports a genuine rejection', async () => {
    const rejected = async () => json({ code: '422-10', detail: 'not eligible' }, 422)
    const gameState = createGameStateSession({ state: paradoxState(), refresh: async () => paradoxState() })
    const { result } = renderHookWithQueries(() =>
      useParadoxResolution({ apiBaseUrl: 'https://api.example.test', fetchFn: server(rejected, false), gameState, perspectiveKey: 'me' }),
    )

    await selectAndConfirm(result)

    expect(result.current.submitPhase).toMatchObject({ kind: 'rejected', code: '422-10' })
    expect(result.current.draft).toEqual({ kind: 'card', cardInstanceId: OFFER, targetEventId: EVENT, targetOutcomeId: OUTCOME })
  })
})
