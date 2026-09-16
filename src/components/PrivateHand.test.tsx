import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { HandCard } from '../types/playerView'
import { PrivateHand } from './PrivateHand'

const hand: readonly HandCard[] = [
  { id: 'card-1', name: 'Anchor Point', grade: 3, description: 'Stabilize an outcome.' },
  { id: 'card-2', name: 'Split the Thread', grade: 2, description: 'Nudge weight.' },
]

describe('PrivateHand', () => {
  it('renders the exact card name and grade as readable text', () => {
    render(<PrivateHand hand={hand} selectedCardId={null} onSelectCard={vi.fn()} />)

    expect(screen.getByText('Anchor Point')).toBeInTheDocument()
    expect(screen.getByText('Grade 3')).toBeInTheDocument()
  })

  it('selects a card by pointer', async () => {
    const onSelectCard = vi.fn()
    render(<PrivateHand hand={hand} selectedCardId={null} onSelectCard={onSelectCard} />)

    await userEvent.click(screen.getByRole('button', { name: /Anchor Point/ }))

    expect(onSelectCard).toHaveBeenCalledWith('card-1')
  })

  it('selects a card by keyboard', async () => {
    const onSelectCard = vi.fn()
    render(<PrivateHand hand={hand} selectedCardId={null} onSelectCard={onSelectCard} />)

    const card = screen.getByRole('button', { name: /Split the Thread/ })
    card.focus()
    await userEvent.keyboard('{Enter}')

    expect(onSelectCard).toHaveBeenCalledWith('card-2')
  })

  it('marks the selected card without relying on color alone', () => {
    render(<PrivateHand hand={hand} selectedCardId="card-1" onSelectCard={vi.fn()} />)

    const card = screen.getByRole('button', { name: /Anchor Point/ })
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(card).toHaveTextContent('Selected card')
  })
})
