import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EventBoardEntry, HandCard } from '../types/playerView'
import { ActionConfirmationPanel } from './ActionConfirmationPanel'

const card: HandCard = {
  id: 'card-1',
  name: 'Push',
  grade: 2,
  description: 'Shift an outcome by +20.',
  kind: 'push',
  isAvailable: true,
}

const event: EventBoardEntry = {
  id: 'evt-2',
  era: 2,
  title: "The Quantum Reactor's First Ignition",
  artwork: 'reactor',
  status: 'in-progress',
  outcomes: [{ id: 'outcome-1', label: 'Ignition succeeds', publicBand: 'medium', isValidTarget: true }],
}

describe('ActionConfirmationPanel', () => {
  it('announces the exact card, grade, event and outcome without including the confirm button', () => {
    render(
      <ActionConfirmationPanel
        selectedCard={card}
        selectedTarget={{ event, outcome: event.outcomes[0] }}
        confirmLabel="Confirm action"
        roundStatus={{ submittedPlayers: 1, totalPlayers: 3, hasSubmitted: false }}
        isSampleData
        onConfirm={vi.fn()}
      />,
    )

    const panel = screen.getByRole('complementary', { name: 'Action confirmation' })
    const summary = within(panel).getByText('Ignition succeeds').closest<HTMLElement>('[aria-live]')
    expect(summary).not.toBeNull()
    expect(summary).toHaveAttribute('aria-live', 'polite')
    expect(summary).toHaveAttribute('aria-atomic', 'true')
    expect(within(summary!).getByText('Push')).toBeInTheDocument()
    expect(within(summary!).getByLabelText('Grade 2')).toBeInTheDocument()
    expect(within(summary!).getByText("The Quantum Reactor's First Ignition")).toBeInTheDocument()
    expect(within(summary!).getByText('Ignition succeeds')).toBeInTheDocument()
    expect(summary).not.toContainElement(within(panel).getByRole('button', { name: 'Confirm action' }))
  })
})
