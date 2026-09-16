import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { HandCard } from '../types/playerView'
import { PrivateHand } from './PrivateHand'

const hand: readonly HandCard[] = [
  { id: 'card-1', name: 'Push', grade: 2, description: 'Shift an outcome.', kind: 'push', isAvailable: true },
  { id: 'card-2', name: 'Scan', grade: 1, description: 'Earn intel.', kind: 'scan', isAvailable: false },
]

describe('PrivateHand', () => {
  it('renders the exact card name and grade as readable text', () => {
    render(<PrivateHand hand={hand} selectedCardId={null} onSelectCard={vi.fn()} />)

    expect(screen.getByText('Push')).toBeInTheDocument()
    expect(screen.getByLabelText('Grade 2')).toBeInTheDocument()
  })

  it('selects an available card by pointer', async () => {
    const onSelectCard = vi.fn()
    render(<PrivateHand hand={hand} selectedCardId={null} onSelectCard={onSelectCard} />)

    await userEvent.click(screen.getByRole('button', { name: /Push/ }))

    expect(onSelectCard).toHaveBeenCalledWith('card-1')
  })

  it('selects an available card by keyboard', async () => {
    const onSelectCard = vi.fn()
    render(<PrivateHand hand={hand} selectedCardId={null} onSelectCard={onSelectCard} />)

    const card = screen.getByRole('button', { name: /Push/ })
    card.focus()
    await userEvent.keyboard('{Enter}')

    expect(onSelectCard).toHaveBeenCalledWith('card-1')
  })

  it('marks the selected card without relying on color alone', () => {
    render(<PrivateHand hand={hand} selectedCardId="card-1" onSelectCard={vi.fn()} />)

    const card = screen.getByRole('button', { name: /Push/ })
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(card).toHaveTextContent('Selected')
  })

  it('disables an unavailable card', () => {
    render(<PrivateHand hand={hand} selectedCardId={null} onSelectCard={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Scan/ })).toBeDisabled()
  })
})
