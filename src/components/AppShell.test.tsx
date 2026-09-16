import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { sampleFixturePlayerView } from '../fixtures/playerView'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('renders the tabletop regions and player strip', () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    expect(screen.getByRole('heading', { name: 'The active futures' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your hand' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your faction' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Action confirmation' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Player scores' })).toBeInTheDocument()
  })

  it('labels fixture state as sample data', () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    expect(screen.getByRole('status')).toHaveTextContent('Sample board')
  })

  it('shows the current phase and deadline in the compact header', () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    expect(screen.getByText('Round 3 of 3')).toBeInTheDocument()
    expect(screen.getByText('Decision window')).toBeInTheDocument()
    expect(screen.getByText('00:43')).toBeInTheDocument()
  })

  it('seeds the exact action summary from the recovered selection and disables fixture submission', () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    const actionPanel = screen.getByRole('complementary', { name: 'Action confirmation' })
    expect(within(actionPanel).getByText('Push')).toBeInTheDocument()
    expect(within(actionPanel).getByText("The Quantum Reactor's First Ignition")).toBeInTheDocument()
    expect(within(actionPanel).getByText('Ignition succeeds')).toBeInTheDocument()
    expect(within(actionPanel).getByRole('button', { name: 'Confirm action' })).toBeDisabled()
  })

  it('updates the exact card and outcome summary when selection changes by pointer', async () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    await userEvent.click(screen.getByRole('button', { name: /Suppress/ }))
    await userEvent.click(screen.getByRole('button', { name: /A splinter agreement forms/ }))

    const actionPanel = screen.getByRole('complementary', { name: 'Action confirmation' })
    expect(within(actionPanel).getByText('Suppress')).toBeInTheDocument()
    expect(within(actionPanel).getByText('A splinter agreement forms')).toBeInTheDocument()
  })

  it('updates the action summary when selection changes by keyboard', async () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    const cardButton = screen.getByRole('button', { name: /Suppress/ })
    cardButton.focus()
    await userEvent.keyboard('{Enter}')

    expect(cardButton).toHaveAttribute('aria-pressed', 'true')
    const actionPanel = screen.getByRole('complementary', { name: 'Action confirmation' })
    expect(within(actionPanel).getByText('Suppress')).toBeInTheDocument()
  })

  it('prompts for selection once the seeded card and outcome are both deselected', async () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    await userEvent.click(screen.getByRole('button', { name: /^Selected.*Push/s }))
    await userEvent.click(screen.getByRole('button', { name: /Ignition succeeds/ }))

    expect(screen.getByText('Choose an available card and a legal outcome.')).toBeInTheDocument()
  })

  it('cannot select a resolved outcome', () => {
    const resolvedView = {
      ...sampleFixturePlayerView,
      events: sampleFixturePlayerView.events.map((event, index) =>
        index === 0
          ? {
              ...event,
              status: 'resolved' as const,
              outcomes: event.outcomes.map((outcome) => ({ ...outcome, isValidTarget: false })),
            }
          : event,
      ),
    }
    render(<AppShell playerView={resolvedView} isSampleData />)

    expect(screen.getByRole('button', { name: /Delegate survives/ })).toBeDisabled()
  })

  it('rehydrates selection from the new pending action when the game changes', () => {
    const { rerender } = render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)
    const nextGame = {
      ...sampleFixturePlayerView,
      gameId: 'fixture-game-2',
      pendingAction: { cardId: 'card-suppress', targetId: 'evt-3-splinter', confirmLabel: 'Confirm action' },
    }

    rerender(<AppShell playerView={nextGame} isSampleData />)

    const actionPanel = screen.getByRole('complementary', { name: 'Action confirmation' })
    expect(within(actionPanel).getByText('Suppress')).toBeInTheDocument()
    expect(within(actionPanel).getByText('A splinter agreement forms')).toBeInTheDocument()
  })

  it('clears a selected outcome that becomes illegal after a same-game refresh', () => {
    const { rerender } = render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)
    const refreshedView = {
      ...sampleFixturePlayerView,
      events: sampleFixturePlayerView.events.map((event) => ({
        ...event,
        outcomes: event.outcomes.map((outcome) =>
          outcome.id === 'evt-2-success' ? { ...outcome, isValidTarget: false } : outcome,
        ),
      })),
    }

    rerender(<AppShell playerView={refreshedView} isSampleData />)

    expect(screen.getByText('Choose an available card and a legal outcome.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ignition succeeds/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('clears a selected card that is no longer in hand after a same-game refresh', () => {
    const { rerender } = render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)
    const refreshedView = {
      ...sampleFixturePlayerView,
      hand: sampleFixturePlayerView.hand.filter((card) => card.id !== 'card-push'),
    }

    rerender(<AppShell playerView={refreshedView} isSampleData />)

    expect(screen.getByText('Choose an available card and a legal outcome.')).toBeInTheDocument()
  })
})
