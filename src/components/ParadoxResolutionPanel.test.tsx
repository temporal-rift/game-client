import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ParadoxResolutionView } from '../paradox/paradoxView'
import { ParadoxResolutionPanel } from './ParadoxResolutionPanel'

const view: Extract<ParadoxResolutionView, { kind: 'open' }> = {
  kind: 'open',
  gameId: 'game-1',
  eraNumber: 2,
  deadline: '2030-01-01T00:00:00Z',
  submittedCount: 1,
  totalPlayers: 3,
  cards: [{ cardInstanceId: 'card-1', cardType: 'STABILIZE', grade: 'I', name: 'Stabilize', effectSummary: 'Steady the event.' }],
  affectedEvents: [
    {
      eventId: 'event-1',
      title: 'Affected event',
      carryOverState: 'FRESH',
      outcomes: [{ outcomeId: 'outcome-1', description: 'First outcome' }],
    },
  ],
}

describe('ParadoxResolutionPanel', () => {
  it('locks draft controls while the current choice is being submitted', () => {
    render(
      <ParadoxResolutionPanel
        view={view}
        draft={{ kind: 'card', cardInstanceId: 'card-1', targetEventId: 'event-1', targetOutcomeId: 'outcome-1' }}
        submitPhase={{ kind: 'submitting' }}
        onSelectCard={vi.fn()}
        onSelectTarget={vi.fn()}
        onClearDraft={vi.fn()}
        onConfirm={vi.fn()}
        onDismissRejection={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /stabilize/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'First outcome' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled()
  })

  it('shows progress and the projected deadline', () => {
    render(
      <ParadoxResolutionPanel
        view={view}
        draft={{ kind: 'none' }}
        submitPhase={{ kind: 'idle' }}
        onSelectCard={vi.fn()}
        onSelectTarget={vi.fn()}
        onClearDraft={vi.fn()}
        onConfirm={vi.fn()}
        onDismissRejection={vi.fn()}
      />,
    )

    expect(screen.getByText('1 / 3 participants have responded.')).toBeInTheDocument()
    expect(screen.getByText(/remaining$/)).toBeInTheDocument()
  })

  it('shows no card when the projected eligible-card list is empty', () => {
    render(
      <ParadoxResolutionPanel
        view={{ ...view, cards: [] }}
        draft={{ kind: 'none' }}
        submitPhase={{ kind: 'idle' }}
        onSelectCard={vi.fn()}
        onSelectTarget={vi.fn()}
        onClearDraft={vi.fn()}
        onConfirm={vi.fn()}
        onDismissRejection={vi.fn()}
      />,
    )

    expect(screen.getByText('No eligible resolution cards are currently available.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /stabilize/i })).not.toBeInTheDocument()
  })

  it('keeps missing progress and deadline unavailable', () => {
    render(
      <ParadoxResolutionPanel
        view={{ ...view, submittedCount: null, totalPlayers: null, deadline: null }}
        draft={{ kind: 'none' }}
        submitPhase={{ kind: 'idle' }}
        onSelectCard={vi.fn()}
        onSelectTarget={vi.fn()}
        onClearDraft={vi.fn()}
        onConfirm={vi.fn()}
        onDismissRejection={vi.fn()}
      />,
    )

    expect(screen.getByText('Phase progress is being refreshed.')).toBeInTheDocument()
    expect(screen.getByText(/Deadline is being refreshed/)).toBeInTheDocument()
  })
})
