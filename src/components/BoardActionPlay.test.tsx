import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticatedFetchFn, GameStateView } from '../api/projection'
import { useActionSubmission } from '../action/useActionSubmission'
import { toBoardView } from '../board/boardView'
import { hasAcceptedSubmission } from '../game/reconciliation'
import type { GameStateSession } from '../game/useGameState'
import { gameStatePayload } from '../test/gameStatePayload'
import { renderWithQueries } from '../test/renderWithQueries'
import { uuid } from '../test/uuid'
import { AppShell } from './AppShell'

const GAME = uuid('game-1')
const ME = uuid('p-me')
const BO = uuid('p-bo')
const CY = uuid('p-cy')
const REACTOR = uuid('evt-reactor')
const HARBOUR = uuid('evt-harbour')
const SUCCEEDS = uuid('out-succeeds')
const FAILS = uuid('out-fails')
const PASSES = uuid('out-passes')
const SWING = uuid('card-swing')
const PUSH = uuid('card-push')
const TRACE = uuid('card-trace')
const DECOY = uuid('card-decoy')
const SCAN = uuid('card-scan')

function roundState(overrides: Partial<GameStateView> = {}): GameStateView {
  return gameStatePayload({
    gameId: GAME,
    revision: 1,
    eraNumber: 1,
    phase: 'ACTION_ROUND_2',
    roundNumber: 2,
    myFaction: 'ERASERS',
    mySpecialActions: ['ANNIHILATE', 'CORRUPT', 'CASCADE'],
    mySpecialBudgets: [],
    myHand: [
      { cardInstanceId: SWING, cardType: 'SWING', grade: 'II', isPlayableThisRound: true },
      { cardInstanceId: PUSH, cardType: 'PUSH', grade: 'II', isPlayableThisRound: true },
      { cardInstanceId: TRACE, cardType: 'TRACE', grade: 'I', isPlayableThisRound: false },
      { cardInstanceId: DECOY, cardType: 'DECOY', grade: 'I', isPlayableThisRound: true },
      { cardInstanceId: SCAN, cardType: 'SCAN', grade: 'II', isPlayableThisRound: true },
    ],
    players: [
      { playerId: ME, playerName: 'Ana', score: 4, isConnected: true },
      { playerId: BO, playerName: 'Bo', score: 3, isConnected: true },
      { playerId: CY, playerName: 'Cy', score: 2, isConnected: false },
    ],
    activeEvents: [
      {
        eventId: REACTOR,
        title: 'Reactor ignition',
        carryOverState: 'FRESH',
        outcomes: [
          { outcomeId: SUCCEEDS, description: 'Ignition succeeds', initialProbability: 50 },
          { outcomeId: FAILS, description: 'Ignition fails', initialProbability: 50 },
        ],
      },
      { eventId: HARBOUR, title: 'Harbour vote', carryOverState: 'FRESH', outcomes: [{ outcomeId: PASSES, description: 'Vote passes', initialProbability: 100 }] },
    ],
    phaseContext: { declarationOpen: false, paradoxOpen: false, actionRoundProgress: { submittedCount: 1, totalPlayers: 3, pendingPlayerIds: [ME, CY] } },
    mySubmissions: [],
    ...overrides,
  })
}

function acceptedState(submission: NonNullable<GameStateView['mySubmissions']>[number]): GameStateView {
  return roundState({
    revision: 2,
    phaseContext: { declarationOpen: false, paradoxOpen: false, actionRoundProgress: { submittedCount: 2, totalPlayers: 3, pendingPlayerIds: [CY] } },
    mySubmissions: [submission],
  })
}

function submittedResponse(): Response {
  return new Response(JSON.stringify({ gameId: GAME, eraNumber: 1, roundNumber: 2, playerId: ME, status: 'SUBMITTED', roundClosed: false }), {
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
  const action = useActionSubmission({ apiBaseUrl: 'https://api.example.test', fetchFn, gameState, ownPlayerId: ME })
  return <AppShell view={toBoardView(state, ME)} status={{ kind: 'ready' }} onRetry={() => undefined} action={action} />
}

function renderBoard({
  initial = roundState(),
  refreshed = initial,
  respond = () => submittedResponse(),
}: { initial?: GameStateView; refreshed?: GameStateView; respond?: () => Response | Promise<Response> } = {}) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => respond())
  renderWithQueries(<Board initial={initial} refreshed={refreshed} fetchFn={fetchMock as unknown as AuthenticatedFetchFn} />)
  return { fetchMock, body: (call = 0) => JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string) as unknown }
}

const actionRegion = () => screen.getByRole('region', { name: 'Your action' })
const handCard = (name: RegExp) => within(screen.getByRole('list', { name: 'Hand' })).getByRole('button', { name })
const confirmButton = () => screen.getByRole('button', { name: 'Confirm action' })

describe('playing an action on the board', () => {
  it('makes the board the action surface, labelled by era and round', () => {
    renderBoard()

    const region = actionRegion()
    expect(region.querySelector('p')).toHaveTextContent('Era 1 · Round 2')
    expect(within(region).getByRole('list', { name: 'Hand' })).toBeInTheDocument()
    expect(within(region).getByRole('list', { name: 'Faction specials' })).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Pass' })).toBeEnabled()
    expect(within(region).getByRole('button', { name: 'Confirm action' })).toBeDisabled()
    expect(screen.queryByRole('group', { name: 'Choose a target' })).not.toBeInTheDocument()
  })

  it('submits a Swing with a source and a different target outcome chosen on the board', async () => {
    const user = userEvent.setup()
    const { body } = renderBoard({
      refreshed: acceptedState({
        eraNumber: 1,
        roundNumber: 2,
        window: 'ACTION',
        choice: 'CARD',
        status: 'ACCEPTED',
        card: { cardInstanceId: SWING, cardType: 'SWING', grade: 'II' },
        targets: { targetEventId: REACTOR, sourceOutcomeId: SUCCEEDS, targetOutcomeId: FAILS },
      }),
    })

    await user.click(handCard(/Swing/))
    const targets = screen.getByRole('group', { name: 'Choose a target' })
    expect(within(targets).getByRole('list', { name: 'Events' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Players' })).not.toBeInTheDocument()
    await user.click(within(screen.getByRole('list', { name: 'Reactor ignition source outcomes' })).getByRole('button', { name: /Ignition succeeds/ }))
    expect(confirmButton()).toBeDisabled()
    const targetOutcomes = screen.getByRole('list', { name: 'Reactor ignition target outcomes' })
    expect(within(targetOutcomes).getByRole('button', { name: /Ignition succeeds/ })).toBeDisabled()
    await user.click(within(targetOutcomes).getByRole('button', { name: /Ignition fails/ }))

    const summary = screen.getByRole('list', { name: 'Chosen targets' })
    expect(summary).toHaveTextContent('Event: Reactor ignition')
    expect(summary).toHaveTextContent('From: Ignition succeeds')
    expect(summary).toHaveTextContent('To: Ignition fails')
    expect(screen.getByText('Grade II')).toBeInTheDocument()
    await user.click(confirmButton())

    expect(body()).toEqual({ actionType: 'CARD', cardInstanceId: SWING, targetEventId: REACTOR, sourceOutcomeId: SUCCEEDS, targetOutcomeId: FAILS })
    expect(await screen.findByText('You have submitted')).toBeInTheDocument()
    expect(screen.getByText(/Your action is submitted for this round\./)).toBeInTheDocument()
    expect(screen.getByText('Swing · Grade II')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm action' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Hand' })).queryAllByRole('button')).toHaveLength(0)
  })

  it('submits a player-targeting special against an opponent chosen in the player strip', async () => {
    const user = userEvent.setup()
    const { body } = renderBoard()

    await user.click(within(screen.getByRole('list', { name: 'Faction specials' })).getByRole('button', { name: /Corrupt/ }))
    const players = within(screen.getByRole('group', { name: 'Choose a target' })).getByRole('list', { name: 'Players' })
    expect(within(players).queryByRole('button', { name: /Ana/ })).not.toBeInTheDocument()
    expect(within(players).getByRole('button', { name: /Cy/ })).toBeDisabled()
    expect(screen.queryByRole('list', { name: 'Events' })).not.toBeInTheDocument()
    await user.click(within(players).getByRole('button', { name: /Bo/ }))
    expect(screen.getByRole('list', { name: 'Chosen targets' })).toHaveTextContent('Player: Bo')
    await user.click(confirmButton())

    expect(body()).toEqual({ actionType: 'SPECIAL', specialAction: 'CORRUPT', targetPlayerId: BO })
  })

  it('shows an unavailable card and special with their reasons and does not let them be selected', () => {
    renderBoard({ initial: roundState({ myJammedUntilRound: 2 }) })

    const trace = handCard(/Trace/)
    expect(trace).toBeDisabled()
    expect(trace).toHaveTextContent('Not playable this round')
    const annihilate = within(screen.getByRole('list', { name: 'Faction specials' })).getByRole('button', { name: /Annihilate/ })
    expect(annihilate).toBeDisabled()
    expect(annihilate).toHaveTextContent('Jammed until round 2.')
  })

  it('asks a Decoy for a disguise only and an event list card for whole events', async () => {
    const user = userEvent.setup()
    renderBoard()

    await user.click(handCard(/Decoy/))
    expect(screen.getByRole('group', { name: 'Choose a disguise' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Choose a target' })).not.toBeInTheDocument()

    await user.click(handCard(/Scan/))
    expect(screen.getByText('Choose 2 events (0/2 chosen).')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Reactor ignition outcomes' })).queryAllByRole('button')).toHaveLength(0)
    const events = screen.getByRole('list', { name: 'Events' })
    await user.click(within(events).getByRole('button', { name: 'Target Reactor ignition' }))
    await user.click(within(events).getByRole('button', { name: 'Target Harbour vote' }))
    expect(confirmButton()).toBeEnabled()
  })

  it('passes, then shows the caller as submitted with no further controls', async () => {
    const user = userEvent.setup()
    const { body } = renderBoard({ refreshed: acceptedState({ eraNumber: 1, roundNumber: 2, window: 'ACTION', choice: 'PASS', status: 'ACCEPTED' }) })

    await user.click(screen.getByRole('button', { name: 'Pass' }))
    expect(screen.getByText('You play no card or special this round.')).toBeInTheDocument()
    await user.click(confirmButton())

    expect(body()).toEqual({ actionType: 'PASS' })
    expect(await screen.findByText('You have submitted')).toBeInTheDocument()
    expect(screen.getByText(/Your action is submitted for this round\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm action' })).not.toBeInTheDocument()
  })

  it('still offers Pass when every card and special is unavailable', () => {
    renderBoard({
      initial: roundState({
        myJammedUntilRound: 3,
        myHand: [{ cardInstanceId: TRACE, cardType: 'TRACE', grade: 'I', isPlayableThisRound: false }],
      }),
    })

    expect(within(screen.getByRole('list', { name: 'Hand' })).getByRole('button')).toBeDisabled()
    for (const special of within(screen.getByRole('list', { name: 'Faction specials' })).getAllByRole('button')) {
      expect(special).toBeDisabled()
    }
    expect(screen.getByRole('button', { name: 'Pass' })).toBeEnabled()
  })

  it('shows a pass rejected because the round closed after the view refreshes into the next phase', async () => {
    const user = userEvent.setup()
    renderBoard({ refreshed: roundState({ revision: 2, phase: 'RESOLUTION', roundNumber: null }), respond: () => problemResponse(409, '409-01') })

    await user.click(screen.getByRole('button', { name: 'Pass' }))
    await user.click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('The round already closed.')
    expect(screen.queryByRole('region', { name: 'Your action' })).not.toBeInTheDocument()
    expect(screen.getByText('No decision window is open')).toBeInTheDocument()
  })

  it('shows a pass rejected as a duplicate alongside the recorded submission', async () => {
    const user = userEvent.setup()
    renderBoard({
      refreshed: acceptedState({ eraNumber: 1, roundNumber: 2, window: 'ACTION', choice: 'SPECIAL', status: 'ACCEPTED', specialAction: 'CASCADE' }),
      respond: () => problemResponse(409, '409-02'),
    })

    await user.click(screen.getByRole('button', { name: 'Pass' }))
    await user.click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('You already submitted for this round.')
    expect(screen.getByText('Cascade', { selector: '.decision-name' })).toBeInTheDocument()
    expect(screen.getByText('You have submitted')).toBeInTheDocument()
  })

  it('keeps a rejected action and its target selected while the round stays open', async () => {
    const user = userEvent.setup()
    renderBoard({ respond: () => problemResponse(422, '422-03') })

    await user.click(handCard(/Push/))
    await user.click(within(screen.getByRole('list', { name: 'Harbour vote outcomes' })).getByRole('button', { name: /Vote passes/ }))
    await user.click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('That target is not legal for this action. Your selection is kept')
    expect(handCard(/Push/)).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('list', { name: 'Harbour vote outcomes' })).getByRole('button', { name: /Vote passes/ })).toHaveAttribute('aria-pressed', 'true')
    expect(confirmButton()).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the accepted action from game state after a lost response, without an error or a resubmission', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderBoard({
      refreshed: acceptedState({
        eraNumber: 1,
        roundNumber: 2,
        window: 'ACTION',
        choice: 'CARD',
        status: 'ACCEPTED',
        card: { cardInstanceId: PUSH, cardType: 'PUSH', grade: 'II' },
        targets: { targetEventId: HARBOUR, targetOutcomeId: PASSES },
      }),
      respond: () => {
        throw new TypeError('network down')
      },
    })

    await user.click(handCard(/Push/))
    await user.click(within(screen.getByRole('list', { name: 'Harbour vote outcomes' })).getByRole('button', { name: /Vote passes/ }))
    await user.click(confirmButton())

    expect(await screen.findByText('Push · Grade II')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Submitted targets' })).toHaveTextContent('Outcome: Vote passes')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('keeps the structure the browser end-to-end suite drives', async () => {
    const user = userEvent.setup()
    renderBoard()
    const region = actionRegion()
    // Playwright matches labels by case-insensitive substring, so only the intended elements may carry these names.
    const labelled = (name: string) =>
      [...region.querySelectorAll('[aria-label]')].filter((element) => element.getAttribute('aria-label')?.toLowerCase().includes(name.toLowerCase()))

    expect(labelled('Your action')).toHaveLength(0)
    expect(labelled('Faction specials')).toHaveLength(1)
    expect(labelled('Faction specials')[0].querySelectorAll('button').length).toBeGreaterThan(0)
    expect(labelled('Hand')[0].querySelectorAll('button')).toHaveLength(5)

    await user.click(handCard(/Swing/))
    const [picker] = labelled('Choose a target')
    const [events] = [...picker.querySelectorAll('[aria-label]')].filter((element) => element.getAttribute('aria-label') === 'Events')
    expect(events.querySelectorAll(':scope > li > button')).toHaveLength(2)
    expect(picker.querySelectorAll("ul[aria-label$='source outcomes'] button")).toHaveLength(3)

    await user.click(handCard(/Push/))
    expect(labelled('Choose a target')[0].querySelectorAll("ul[aria-label$='outcomes'] button")).toHaveLength(3)

    await user.click(within(screen.getByRole('list', { name: 'Faction specials' })).getByRole('button', { name: /Corrupt/ }))
    const [playerPicker] = labelled('Choose a target')
    expect(playerPicker.querySelector("[aria-label='Players']")?.querySelectorAll('button')).toHaveLength(2)
    expect(labelled('Choose a target')).toHaveLength(1)
  })

  it('offers no action controls outside an action round', () => {
    renderBoard({ initial: roundState({ phase: 'PARADOX_RESOLUTION' }) })

    expect(screen.queryByRole('region', { name: 'Your action' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Hand' })).queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm action' })).not.toBeInTheDocument()
  })
})
