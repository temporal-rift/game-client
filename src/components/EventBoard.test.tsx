import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EventBoardEntry } from '../types/playerView'
import { EventBoard } from './EventBoard'

const events: readonly EventBoardEntry[] = [
  {
    id: 'evt-1',
    era: 2,
    title: 'Resolved Event',
    artwork: 'delegate',
    status: 'resolved',
    outcomes: [{ id: 'resolved-outcome', label: 'Resolved branch', publicBand: 'medium', isValidTarget: false }],
  },
  {
    id: 'evt-2',
    era: 2,
    title: 'Open Event',
    artwork: 'reactor',
    status: 'in-progress',
    outcomes: [{ id: 'open-outcome', label: 'Open branch', publicBand: 'high', isValidTarget: true }],
  },
  {
    id: 'evt-3',
    era: 2,
    title: 'Hidden Future',
    artwork: 'pact',
    status: 'upcoming',
    outcomes: [{ id: 'hidden-outcome', label: 'Unobserved branch', publicBand: 'unknown', isValidTarget: true }],
  },
]

function renderBoard(selectedTargetId: string | null, onSelectTarget = vi.fn()) {
  return {
    onSelectTarget,
    ...render(
      <EventBoard
        events={events}
        publicBandAgeLabel="Bands from round 2"
        selectedTargetId={selectedTargetId}
        onSelectTarget={onSelectTarget}
      />,
    ),
  }
}

describe('EventBoard', () => {
  it('renders readable event titles, outcome labels, statuses and qualitative bands', () => {
    renderBoard(null)

    expect(screen.getByText('Resolved Event')).toBeInTheDocument()
    expect(screen.getByText('Resolved branch')).toBeInTheDocument()
    expect(screen.getByText('Resolved')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText('Bands from round 2')).toBeInTheDocument()
  })

  it('never invents exact numbers for an unknown band', () => {
    renderBoard(null)

    const hiddenOutcome = screen.getByRole('button', { name: /Unobserved branch/ })
    expect(hiddenOutcome).toHaveTextContent('Unknown')
    expect(hiddenOutcome).not.toHaveTextContent(/\d+\s*\/\s*\d+/)
  })

  it('disables an outcome that is not a legal target', () => {
    renderBoard(null)

    expect(screen.getByRole('button', { name: /Resolved branch/ })).toBeDisabled()
  })

  it('selects a valid outcome by pointer', async () => {
    const { onSelectTarget } = renderBoard(null)

    await userEvent.click(screen.getByRole('button', { name: /Open branch/ }))

    expect(onSelectTarget).toHaveBeenCalledWith('open-outcome')
  })

  it('selects a valid outcome by keyboard', async () => {
    const onSelectTarget = vi.fn()
    renderBoard(null, onSelectTarget)

    const target = screen.getByRole('button', { name: /Open branch/ })
    target.focus()
    await userEvent.keyboard('{Enter}')

    expect(onSelectTarget).toHaveBeenCalledWith('open-outcome')
  })

  it('marks the selected outcome without relying on color alone', () => {
    renderBoard('open-outcome')

    const target = screen.getByRole('button', { name: /Open branch/ })
    expect(target).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Selected target')).toBeInTheDocument()
  })
})
