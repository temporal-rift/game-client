import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DeclarationView } from '../declaration/declarationView'
import { DeclarationPanel } from './DeclarationPanel'

const view: Extract<DeclarationView, { kind: 'open' }> = {
  kind: 'open',
  gameId: 'game-1',
  eraNumber: 2,
  deadline: '2030-01-01T00:01:30Z',
  eligibleModes: ['RALLY', 'MOMENTUM'],
  activeEvents: [
    {
      eventId: 'event-1',
      title: 'Reactor ignition',
      carryOverState: 'FRESH',
      outcomes: [{ outcomeId: 'outcome-1', description: 'Ignition succeeds' }],
    },
  ],
}

function renderPanel(overrides = {}) {
  return render(
    <DeclarationPanel
      view={view}
      draft={{ kind: 'none' }}
      submitPhase={{ kind: 'idle' }}
      onSelectMode={vi.fn()}
      onSelectTarget={vi.fn()}
      onClearDraft={vi.fn()}
      onSkip={vi.fn()}
      onConfirm={vi.fn()}
      onDismissRejection={vi.fn()}
      {...overrides}
    />,
  )
}

describe('DeclarationPanel', () => {
  it('requires a currently offered target for a readable confirmation review', () => {
    renderPanel({
      view: { ...view, activeEvents: [] },
      draft: { kind: 'declaration', mode: 'RALLY', targetEventId: 'event-1', targetOutcomeId: 'outcome-1' },
    })
    expect(screen.getByRole('button', { name: 'Confirm declaration' })).toBeDisabled()
    expect(screen.getByText(/Declaration targets are still being refreshed/)).toBeInTheDocument()
  })
  it('names the chosen event and outcome and explains Round 1 consumption before confirmation', () => {
    renderPanel({ draft: { kind: 'declaration', mode: 'RALLY', targetEventId: 'event-1', targetOutcomeId: 'outcome-1' } })
    expect(screen.getByText(/Rally · Reactor ignition → Ignition succeeds/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm declaration' })).toBeEnabled()
  })

  it('permits only retrying a decline after a lost response', () => {
    renderPanel({ submitPhase: { kind: 'decline-unknown', message: 'Retry safely.' } })
    expect(screen.getByRole('button', { name: 'Retry decline' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Rally' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirm declaration' })).toBeDisabled()
  })
  it('offers each eligible declaration with a brief explanation and the server countdown', () => {
    renderPanel()

    expect(screen.getByRole('button', { name: 'Rally' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Momentum' })).toBeInTheDocument()
    expect(screen.getByText(/remaining in the declaration window$/)).toBeInTheDocument()
  })

  it('renders no control when the caller cannot declare', () => {
    const { container } = render(
      <DeclarationPanel
        view={{ kind: 'unavailable', reason: 'Your faction cannot declare in this window.' }}
        draft={{ kind: 'none' }}
        submitPhase={{ kind: 'idle' }}
        onSelectMode={vi.fn()}
        onSelectTarget={vi.fn()}
        onClearDraft={vi.fn()}
        onSkip={vi.fn()}
        onConfirm={vi.fn()}
        onDismissRejection={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('requires a target before confirming and offers a declaration decline', () => {
    renderPanel({ draft: { kind: 'declaration', mode: 'RALLY', targetEventId: '', targetOutcomeId: '' } })

    expect(screen.getByRole('button', { name: 'Confirm declaration' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decline declaration' })).toBeEnabled()
  })

  it('locks controls while the declaration is being submitted', () => {
    renderPanel({
      draft: { kind: 'declaration', mode: 'RALLY', targetEventId: 'event-1', targetOutcomeId: 'outcome-1' },
      submitPhase: { kind: 'submitting' },
    })

    expect(screen.getByRole('button', { name: 'Rally' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ignition succeeds' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled()
  })

  it('shows the accepted state without offering a second declaration', () => {
    render(
      <DeclarationPanel
        view={{ kind: 'submitted', eraNumber: 2, deadline: '2030-01-01T00:01:30Z' }}
        draft={{ kind: 'none' }}
        submitPhase={{ kind: 'idle' }}
        onSelectMode={vi.fn()}
        onSelectTarget={vi.fn()}
        onClearDraft={vi.fn()}
        onSkip={vi.fn()}
        onConfirm={vi.fn()}
        onDismissRejection={vi.fn()}
      />,
    )

    expect(screen.getByText('Your declaration was accepted.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm declaration' })).not.toBeInTheDocument()
  })
})
