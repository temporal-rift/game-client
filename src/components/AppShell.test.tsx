import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { sampleFixturePlayerView } from '../fixtures/playerView'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('renders the event board, private hand, faction/intel and action confirmation regions', () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    expect(screen.getByRole('heading', { name: 'Event board' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Private hand' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Faction & intel' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Action confirmation' })).toBeInTheDocument()
  })

  it('labels fixture state as sample data', () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    expect(screen.getByRole('status')).toHaveTextContent('sample data')
  })

  it('shows the current phase and deadline', () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    expect(screen.getByText(/Action round 2 of 3/)).toBeInTheDocument()
    expect(screen.getByText(/Deadline: in 4 minutes/)).toBeInTheDocument()
  })

  it('seeds the confirmation summary from the recovered selection and disables it for sample data', () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    expect(screen.getByText(/Anchor Point \(grade 3\) → Convergence at the Vault/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: sampleFixturePlayerView.pendingAction!.confirmLabel })).toBeDisabled()
  })

  it('updates the confirmation summary to identify the exact card, grade and target when selection changes by pointer', async () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    await userEvent.click(screen.getByRole('button', { name: /Split the Thread/ }))
    await userEvent.click(screen.getByRole('button', { name: /The Last Delegation/ }))

    expect(screen.getByText(/Split the Thread \(grade 2\) → The Last Delegation/)).toBeInTheDocument()
  })

  it('updates the confirmation summary when selection changes by keyboard', async () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    const cardButton = screen.getByRole('button', { name: /Split the Thread/ })
    cardButton.focus()
    await userEvent.keyboard('{Enter}')

    expect(cardButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Split the Thread \(grade 2\) → Convergence at the Vault/)).toBeInTheDocument()
  })

  it('prompts for a selection once the seeded card and target are both deselected', async () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    await userEvent.click(screen.getByRole('button', { name: /Anchor Point/ }))

    expect(screen.getByText('Select a card and a target to confirm an action.')).toBeInTheDocument()
  })

  it('cannot select a resolved event as a target', () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    expect(screen.getByRole('button', { name: /The Signal Fractures/ })).toBeDisabled()
  })

  it('rehydrates the selection from the new pending action when the game changes', () => {
    const { rerender } = render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    const nextGame = {
      ...sampleFixturePlayerView,
      gameId: 'fixture-game-2',
      pendingAction: { cardId: 'card-2', targetId: 'evt-3', confirmLabel: 'Confirm action' },
    }
    rerender(<AppShell playerView={nextGame} isSampleData />)

    expect(screen.getByText(/Split the Thread \(grade 2\) → The Last Delegation/)).toBeInTheDocument()
  })

  it('clears a selected target that becomes illegal after a same-game refresh instead of leaving it confirmable', () => {
    const { rerender } = render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    const refreshedView = {
      ...sampleFixturePlayerView,
      events: sampleFixturePlayerView.events.map((event) =>
        event.id === 'evt-2' ? { ...event, isValidTarget: false } : event,
      ),
    }
    rerender(<AppShell playerView={refreshedView} isSampleData />)

    expect(screen.getByText('Select a card and a target to confirm an action.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Convergence at the Vault/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('clears a selected card that is no longer in hand after a same-game refresh', () => {
    const { rerender } = render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    const refreshedView = {
      ...sampleFixturePlayerView,
      hand: sampleFixturePlayerView.hand.filter((card) => card.id !== 'card-1'),
    }
    rerender(<AppShell playerView={refreshedView} isSampleData />)

    expect(screen.getByText('Select a card and a target to confirm an action.')).toBeInTheDocument()
  })
})
