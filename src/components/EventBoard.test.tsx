import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EventBoardEntry } from '../types/playerView'
import { EventBoard } from './EventBoard'
import { BandPatternDefs } from './BandMeter'

const events: readonly EventBoardEntry[] = [
  { id: 'evt-1', era: 1, title: 'Resolved Event', publicBand: '30 / 45 / 25', status: 'resolved', isValidTarget: false },
  { id: 'evt-2', era: 1, title: 'Open Event', publicBand: '40 / 40 / 20', status: 'in-progress', isValidTarget: true },
  { id: 'evt-3', era: 1, title: 'Hidden Future', publicBand: 'unknown', status: 'upcoming', isValidTarget: true },
]

function renderBoard(selectedTargetId: string | null, onSelectTarget = vi.fn()) {
  return {
    onSelectTarget,
    ...render(
      <>
        <BandPatternDefs />
        <EventBoard events={events} selectedTargetId={selectedTargetId} onSelectTarget={onSelectTarget} />
      </>,
    ),
  }
}

describe('EventBoard', () => {
  it('renders readable status, era and band text for every event', () => {
    renderBoard(null)

    expect(screen.getByText('Resolved Event')).toBeInTheDocument()
    expect(screen.getByText('Resolved')).toBeInTheDocument()
    expect(screen.getByText('30 / 45 / 25')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('never invents exact numbers for an unknown band', () => {
    renderBoard(null)

    const hiddenFuture = screen.getByRole('button', { name: /Hidden Future/ })
    expect(hiddenFuture).toHaveTextContent('Unknown')
    expect(hiddenFuture).not.toHaveTextContent(/\d+ \/ \d+ \/ \d+/)
  })

  it('disables a resolved event so it cannot be selected as a target', () => {
    renderBoard(null)

    expect(screen.getByRole('button', { name: /Resolved Event/ })).toBeDisabled()
  })

  it('selects a valid target by pointer and reflects the selection in aria-pressed', async () => {
    const { onSelectTarget } = renderBoard(null)

    await userEvent.click(screen.getByRole('button', { name: /Open Event/ }))

    expect(onSelectTarget).toHaveBeenCalledWith('evt-2')
  })

  it('selects a valid target by keyboard', async () => {
    const onSelectTarget = vi.fn()
    renderBoard(null, onSelectTarget)

    const target = screen.getByRole('button', { name: /Open Event/ })
    target.focus()
    await userEvent.keyboard('{Enter}')

    expect(onSelectTarget).toHaveBeenCalledWith('evt-2')
  })

  it('marks the currently selected target without relying on color alone', () => {
    renderBoard('evt-2')

    const target = screen.getByRole('button', { name: /Open Event/ })
    expect(target).toHaveAttribute('aria-pressed', 'true')
    expect(target).toHaveTextContent('Selected target')
  })
})
