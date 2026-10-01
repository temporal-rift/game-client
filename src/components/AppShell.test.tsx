import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameStateView } from '../api/projection'
import { toBoardView } from '../board/boardView'
import { baseGameState } from '../game/gameStateFixtures'
import type { GameStateStatus } from '../game/useGameState'
import { AppShell } from './AppShell'

const READY: GameStateStatus = { kind: 'ready' }

function liveState(overrides: Partial<GameStateView> = {}): GameStateView {
  return baseGameState({
    eraNumber: 1,
    phase: 'ACTION_ROUND_2',
    roundNumber: 2,
    myFaction: 'PROPHETS',
    myScore: 8,
    winScoreThreshold: 20,
    players: [
      { playerId: 'p-me', playerName: 'Ana', score: 8, isConnected: true, faction: null },
      { playerId: 'p-bo', playerName: 'Bo', score: 6, isConnected: true, faction: null },
      { playerId: 'p-cy', playerName: 'Cy', score: 5, isConnected: true, faction: null },
    ],
    activeEvents: [
      {
        eventId: 'evt-1',
        title: 'Reactor ignition',
        carryOverState: 'FRESH',
        outcomes: [{ outcomeId: 'out-1', description: 'Ignition succeeds', initialProbability: 100 }],
      },
    ],
    publicBands: [{ eventId: 'evt-1', observedInRound: 2, outcomes: [{ outcomeId: 'out-1', band: 'MEDIUM' }] }],
    phaseContext: {
      declarationOpen: false,
      paradoxOpen: false,
      actionRoundProgress: { submittedCount: 1, totalPlayers: 3, pendingPlayerIds: ['p-me', 'p-bo'] },
    },
    ...overrides,
  })
}

function renderBoard(state: GameStateView | null, status: GameStateStatus = READY, onRetry = vi.fn()) {
  const view = state ? toBoardView(state, 'p-me') : null
  return { onRetry, ...render(<AppShell view={view} status={status} onRetry={onRetry} />) }
}

describe('AppShell', () => {
  afterEach(() => vi.useRealTimers())

  it('shows the live era, round, events, bands, roster names and own faction without a sample notice', () => {
    renderBoard(liveState())

    expect(screen.getByText('Era 1')).toBeInTheDocument()
    expect(screen.getByText('Round 2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reactor ignition' })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Reactor ignition outcomes' })).getByText('Medium')).toBeInTheDocument()
    const players = screen.getByRole('region', { name: 'Player scores' })
    expect(within(players).getByText('Ana')).toBeInTheDocument()
    expect(within(players).getByText('Bo')).toBeInTheDocument()
    expect(within(players).getByText('Cy')).toBeInTheDocument()
    expect(screen.getByText('You · Prophets')).toBeInTheDocument()
    expect(screen.queryByText(/sample/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/fixture/i)).not.toBeInTheDocument()
  })

  it('shows another player’s unrevealed faction as hidden', () => {
    renderBoard(liveState())

    const players = screen.getByRole('region', { name: 'Player scores' })
    expect(within(players).getAllByText('Faction hidden')).toHaveLength(2)
    expect(within(players).queryByText(/Prophets/)).toHaveTextContent('You · Prophets')
  })

  it('shows round progress and that the current player has not submitted', () => {
    renderBoard(liveState())

    expect(screen.getByText('1 / 3 players submitted')).toBeInTheDocument()
    expect(screen.getByText('You have not submitted')).toBeInTheDocument()
  })

  it('counts down to the server deadline, stops at zero, and changes phase only with new state', () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-10-02T10:00:00Z'))
    const state = liveState({ deadlines: { actionRoundExpiresAt: '2026-10-02T10:01:30Z' } })
    const { rerender } = renderBoard(state)

    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('1:30')
    act(() => vi.advanceTimersByTime(30_000))
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('1:00')
    act(() => vi.advanceTimersByTime(120_000))
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('0:00')
    expect(screen.getByText('Action round')).toBeInTheDocument()

    const next = liveState({ phase: 'PARADOX_RESOLUTION', roundNumber: 2, deadlines: {} })
    rerender(<AppShell view={toBoardView(next, 'p-me')} status={READY} onRetry={vi.fn()} />)
    expect(screen.getByText('Paradox resolution')).toBeInTheDocument()
    expect(screen.queryByLabelText('Time remaining')).not.toBeInTheDocument()
  })

  it('shows a loading state and no board content before the first state arrives', () => {
    renderBoard(null, { kind: 'loading' })

    expect(screen.getByText('Loading the game…')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Player scores' })).not.toBeInTheDocument()
  })

  it('shows the recoverable error with retry and no board content when the state cannot be loaded', async () => {
    const { onRetry } = renderBoard(null, { kind: 'failed', message: 'Game not found, or you are not a participant of it.', code: '404-01' })

    expect(screen.getByRole('alert')).toHaveTextContent('Game not found, or you are not a participant of it.')
    expect(screen.queryByRole('heading', { name: 'The active futures' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Player scores' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('keeps the last state visible with the error while polls fail', () => {
    renderBoard(liveState(), { kind: 'stalled', message: 'Could not reach the server.', code: null })

    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server.')
    expect(screen.getByText('Round 2 of 3')).toBeInTheDocument()
  })
})
