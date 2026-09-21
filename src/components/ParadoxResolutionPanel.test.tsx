import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ParadoxResolutionView } from '../paradox/paradoxView'
import { ParadoxResolutionPanel } from './ParadoxResolutionPanel'

const view: Extract<ParadoxResolutionView, { kind: 'open' }> = {
  kind: 'open',
  gameId: 'game-1',
  eraNumber: 2,
  timerRemainingSeconds: 30,
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
})
