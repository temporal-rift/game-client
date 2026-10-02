import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedFetchFn, GameStateView } from '../api/projection'
import { toBoardView } from '../board/boardView'
import { hasAcceptedSubmission } from '../game/reconciliation'
import type { GameStateSession } from '../game/useGameState'
import { useParadoxResolution } from '../paradox/useParadoxResolution'
import { gameStatePayload } from '../test/gameStatePayload'
import { renderWithQueries } from '../test/renderWithQueries'
import { uuid } from '../test/uuid'
import { AppShell } from './AppShell'

const GAME = uuid('game-1')
const ME = uuid('p-me')
const BO = uuid('p-bo')
const TREATY = uuid('evt-treaty')
const HARVEST = uuid('evt-harvest')
const SIGNED = uuid('out-signed')
const BROKEN = uuid('out-broken')
const DELAYED = uuid('out-delayed')
const RICH = uuid('out-rich')
const PARADOX = uuid('paradox-1')
const STABILIZE = uuid('card-stabilize')
const PUSH = uuid('card-push')

function phaseState(overrides: Partial<GameStateView> = {}): GameStateView {
  return gameStatePayload({
    gameId: GAME,
    revision: 1,
    eraNumber: 2,
    phase: 'PARADOX_RESOLUTION',
    roundNumber: 3,
    myFaction: 'ERASERS',
    myHand: [{ cardInstanceId: PUSH, cardType: 'PUSH', grade: 'II', isPlayableThisRound: false }],
    players: [
      { playerId: ME, playerName: 'Ana', score: 4, isConnected: true },
      { playerId: BO, playerName: 'Bo', score: 3, isConnected: true },
    ],
    activeEvents: [
      {
        eventId: TREATY,
        title: 'Treaty',
        carryOverState: 'FRESH',
        outcomes: [
          { outcomeId: SIGNED, description: 'Signed', initialProbability: 40 },
          { outcomeId: BROKEN, description: 'Broken', initialProbability: 40 },
          { outcomeId: DELAYED, description: 'Delayed', initialProbability: 20 },
        ],
      },
      { eventId: HARVEST, title: 'Harvest', carryOverState: 'FRESH', outcomes: [{ outcomeId: RICH, description: 'Rich', initialProbability: 100 }] },
    ],
    deadlines: { paradoxResolutionExpiresAt: '2030-01-01T00:00:00Z' },
    phaseContext: {
      declarationOpen: false,
      paradoxOpen: true,
      paradoxes: [{ paradoxId: PARADOX, type: 'DEAD_HEAT', affectedEventId: TREATY, affectedOutcomeIds: [SIGNED, BROKEN] }],
      affectedEventIds: [TREATY],
      paradoxResolutionProgress: { submittedCount: 0, totalPlayers: 2, pendingPlayerIds: [ME, BO] },
    },
    myEligibleResolutionCards: [
      { cardInstanceId: STABILIZE, cardType: 'STABILIZE', grade: 'I' },
      { cardInstanceId: PUSH, cardType: 'PUSH', grade: 'II' },
    ],
    mySubmissions: [],
    ...overrides,
  })
}

function acceptedState(submission: NonNullable<GameStateView['mySubmissions']>[number]): GameStateView {
  return phaseState({
    revision: 2,
    phaseContext: {
      declarationOpen: false,
      paradoxOpen: true,
      paradoxes: [{ paradoxId: PARADOX, type: 'DEAD_HEAT', affectedEventId: TREATY, affectedOutcomeIds: [SIGNED, BROKEN] }],
      affectedEventIds: [TREATY],
      paradoxResolutionProgress: { submittedCount: 1, totalPlayers: 2, pendingPlayerIds: [BO] },
    },
    myEligibleResolutionCards: undefined,
    mySubmissions: [submission],
  })
}

const closedState = () => phaseState({ revision: 2, phase: 'RESOLUTION', phaseContext: { declarationOpen: false, paradoxOpen: false }, myEligibleResolutionCards: undefined })

function submittedResponse(): Response {
  return new Response(JSON.stringify({ gameId: GAME, eraNumber: 2, playerId: ME, status: 'SUBMITTED' }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  })
}

function problemResponse(status: number, code: string): Response {
  return new Response(JSON.stringify({ code, detail: 'rejected' }), { status, headers: { 'Content-Type': 'application/problem+json' } })
}

/** The live board over a game state that the hook's refresh replaces, like the real polled state. */
function Board({ initial, refreshed, fetchFn }: { readonly initial: GameStateView; readonly refreshed: GameStateView; readonly fetchFn: AuthenticatedFetchFn }) {
  const [state, setState] = useState(initial)
  const gameState = useMemo<GameStateSession>(
    () => ({
      state,
      status: { kind: 'ready' },
      refresh: async () => {
        setState(refreshed)
        return refreshed
      },
      hasAcceptedSubmission: (query) => hasAcceptedSubmission(state, query),
    }),
    [state, refreshed],
  )
  const paradox = useParadoxResolution({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState })
  return <AppShell view={toBoardView(state, ME)} status={{ kind: 'ready' }} onRetry={() => undefined} paradox={paradox} />
}

function renderBoard({
  initial = phaseState(),
  refreshed = initial,
  respond = () => submittedResponse(),
}: { initial?: GameStateView; refreshed?: GameStateView; respond?: () => Response | Promise<Response> } = {}) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => respond())
  renderWithQueries(<Board initial={initial} refreshed={refreshed} fetchFn={fetchMock as unknown as AuthenticatedFetchFn} />)
  return { fetchMock, body: (call = 0) => JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string) as unknown }
}

const region = () => screen.getByRole('region', { name: 'Paradox resolution' })
const eligibleCard = (name: RegExp) => within(screen.getByRole('list', { name: 'Eligible resolution cards' })).getByRole('button', { name })
const affectedOutcome = (event: string, name: string) =>
  within(within(screen.getByRole('group', { name: 'Affected events' })).getByRole('list', { name: `${event} outcomes` })).getByRole('button', {
    name: new RegExp(name),
  })
const confirmButton = () => screen.getByRole('button', { name: 'Confirm resolution choice' })

afterEach(() => {
  vi.useRealTimers()
})

describe('resolving a paradox on the board', () => {
  it('makes the board the paradox-resolution surface, labelled by era, with no separate panel', () => {
    renderBoard()

    const surface = region()
    expect(surface.querySelector('p')).toHaveTextContent('Era 2 · Paradox resolution')
    expect(within(surface).getByRole('list', { name: 'Eligible resolution cards' })).toBeInTheDocument()
    expect(within(surface).getByRole('button', { name: 'Pass' })).toBeEnabled()
    expect(within(surface).getByRole('button', { name: 'Confirm resolution choice' })).toBeDisabled()
    expect(screen.getAllByRole('region', { name: 'Paradox resolution' })).toHaveLength(1)
    expect(screen.queryByRole('list', { name: 'Hand' })).not.toBeInTheDocument()
  })

  it('marks only the affected event with its paradox type and affected outcomes', () => {
    renderBoard()

    expect(within(screen.getByRole('list', { name: 'Treaty paradoxes' })).getByText('Dead Heat')).toBeInTheDocument()
    const treatyOutcomes = screen.getByRole('list', { name: 'Treaty outcomes' })
    expect(within(treatyOutcomes).getByText('Signed').closest('li')).toHaveTextContent('Affected')
    expect(within(treatyOutcomes).getByText('Broken').closest('li')).toHaveTextContent('Affected')
    expect(within(treatyOutcomes).getByText('Delayed').closest('li')).not.toHaveTextContent('Affected')
    expect(screen.queryByRole('list', { name: 'Harvest paradoxes' })).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Harvest outcomes' })).not.toHaveTextContent('Affected')
    expect(within(screen.getByRole('list', { name: 'Open paradoxes' })).getByText('Dead Heat · Treaty')).toBeInTheDocument()
  })

  it('counts down to the phase deadline in the header', () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-10-02T10:00:00Z'))
    renderBoard({ initial: phaseState({ deadlines: { paradoxResolutionExpiresAt: '2026-10-02T10:00:45Z' } }) })

    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('0:45')
    expect(screen.getByLabelText('Current game phase').closest('header')).toHaveTextContent('Paradox resolution')
  })

  it('submits an eligible card with its target on an affected event and shows it as submitted', async () => {
    const user = userEvent.setup()
    const { body } = renderBoard({
      refreshed: acceptedState({
        eraNumber: 2,
        roundNumber: null,
        window: 'PARADOX_RESOLUTION',
        choice: 'CARD',
        status: 'ACCEPTED',
        card: { cardInstanceId: STABILIZE, cardType: 'STABILIZE', grade: 'I' },
        targets: { targetEventId: TREATY, targetOutcomeId: SIGNED },
      }),
    })

    await user.click(eligibleCard(/Stabilize/))
    expect(confirmButton()).toBeDisabled()
    expect(within(screen.getByRole('list', { name: 'Harvest outcomes' })).queryAllByRole('button')).toHaveLength(0)
    await user.click(affectedOutcome('Treaty', 'Signed'))
    expect(screen.getByRole('list', { name: 'Chosen targets' })).toHaveTextContent('Event: Treaty')
    expect(screen.getByRole('list', { name: 'Chosen targets' })).toHaveTextContent('Outcome: Signed')
    await user.click(confirmButton())

    expect(body()).toEqual({ actionType: 'CARD', cardInstanceId: STABILIZE, targetEventId: TREATY, targetOutcomeId: SIGNED })
    expect(await screen.findByText(/Your resolution choice is submitted for this phase\./)).toBeInTheDocument()
    expect(screen.getByText('Stabilize · Grade I')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Submitted targets' })).toHaveTextContent('Outcome: Signed')
    expect(screen.queryByRole('button', { name: 'Confirm resolution choice' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Eligible resolution cards' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Affected events' })).not.toBeInTheDocument()
  })

  it('passes without spending a card and closes the controls for the phase', async () => {
    const user = userEvent.setup()
    const { body, fetchMock } = renderBoard({
      refreshed: acceptedState({ eraNumber: 2, roundNumber: null, window: 'PARADOX_RESOLUTION', choice: 'PASS', status: 'ACCEPTED' }),
    })

    await user.click(within(region()).getByRole('button', { name: 'Pass' }))
    await user.click(confirmButton())

    expect(body()).toEqual({ actionType: 'PASS' })
    expect(await screen.findByText(/Your resolution choice is submitted for this phase\./)).toBeInTheDocument()
    expect(screen.getByText('Pass', { selector: '.decision-name' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm resolution choice' })).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Hand' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows a pass rejected because the phase closed and refreshes the view', async () => {
    const user = userEvent.setup()
    renderBoard({ refreshed: closedState(), respond: () => problemResponse(409, '409-06') })

    await user.click(within(region()).getByRole('button', { name: 'Pass' }))
    await user.click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(/phase already closed/i)
    expect(screen.queryByRole('region', { name: 'Paradox resolution' })).not.toBeInTheDocument()
  })

  it('shows a pass rejected because a choice was already submitted', async () => {
    const user = userEvent.setup()
    renderBoard({
      refreshed: acceptedState({ eraNumber: 2, roundNumber: null, window: 'PARADOX_RESOLUTION', choice: 'PASS', status: 'ACCEPTED' }),
      respond: () => problemResponse(409, '409-07'),
    })

    await user.click(within(region()).getByRole('button', { name: 'Pass' }))
    await user.click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(/already submitted a paradox-resolution choice/i)
    expect(screen.getByText(/Your resolution choice is submitted for this phase\./)).toBeInTheDocument()
  })

  it('keeps a rejected card and its target selected while the phase is open', async () => {
    const user = userEvent.setup()
    renderBoard({ respond: () => problemResponse(422, '422-06') })

    await user.click(eligibleCard(/Stabilize/))
    await user.click(affectedOutcome('Treaty', 'Broken'))
    await user.click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(/current game's era/i)
    expect(screen.getByRole('alert')).toHaveTextContent('Your selection is kept')
    expect(eligibleCard(/Stabilize/)).toHaveAttribute('aria-pressed', 'true')
    expect(affectedOutcome('Treaty', 'Broken')).toHaveAttribute('aria-pressed', 'true')
    expect(confirmButton()).toBeEnabled()
  })

  it('shows a choice whose response was lost as accepted, without an error or a retry', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderBoard({
      refreshed: acceptedState({ eraNumber: 2, roundNumber: null, window: 'PARADOX_RESOLUTION', choice: 'PASS', status: 'ACCEPTED' }),
      respond: () => Promise.reject(new TypeError('response lost')),
    })

    await user.click(within(region()).getByRole('button', { name: 'Pass' }))
    await user.click(confirmButton())

    expect(await screen.findByText(/Your resolution choice is submitted for this phase\./)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('still offers a pass when no resolution card is eligible', () => {
    renderBoard({ initial: phaseState({ myEligibleResolutionCards: [] }) })

    expect(screen.queryByRole('list', { name: 'Eligible resolution cards' })).not.toBeInTheDocument()
    expect(screen.getByText(/No eligible resolution cards this phase/)).toBeInTheDocument()
    expect(within(region()).getByRole('button', { name: 'Pass' })).toBeEnabled()
  })

  it('keeps the accessible names the browser suite drives a card choice through', async () => {
    const user = userEvent.setup()
    renderBoard()

    const surface = screen.getByLabelText('Paradox resolution')
    await user.click(within(within(surface).getByLabelText('Eligible resolution cards')).getAllByRole('button')[0])
    const outcomeButtons = within(surface).getByLabelText('Affected events').querySelectorAll("ul[aria-label$='outcomes'] button")
    expect(outcomeButtons).toHaveLength(3)
    await user.click(outcomeButtons[0] as HTMLElement)
    expect(within(surface).getByRole('button', { name: 'Confirm resolution choice' })).toBeEnabled()
  })

  it('offers no paradox controls outside the phase', () => {
    renderBoard({ initial: closedState() })

    expect(screen.queryByRole('region', { name: 'Paradox resolution' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm resolution choice' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Eligible resolution cards' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Treaty paradoxes' })).not.toBeInTheDocument()
  })
})

it('waits for game state before showing a choice accepted without its projection', async () => {
  const user = userEvent.setup()
  renderBoard({ refreshed: phaseState({ revision: 2 }) })

  await user.click(within(region()).getByRole('button', { name: 'Pass' }))
  await user.click(confirmButton())

  await waitFor(() => expect(screen.getByText('Waiting for game state to reflect your choice.')).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Confirm resolution choice' })).not.toBeInTheDocument()
})
