import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HandSelectionPanel } from './HandSelectionPanel'
import type { HandSelectionView } from '../hand/handSelectionView'

const view: Extract<HandSelectionView, { kind: 'open' }> = {
  kind: 'open' as const,
  gameId: 'game-1', eraNumber: 2, requiredSelectionCount: 5 as const, expiresAt: '2026-10-01T12:00:00Z',
  cards: Array.from({ length: 7 }, (_, index) => ({ cardInstanceId: `card-${index + 1}`, cardType: 'PUSH' as const, grade: 'II' as const, dealSlot: index + 1, name: 'Push', effectSummary: 'Raises one outcome.' })),
}

describe('HandSelectionPanel', () => {
  it('keeps confirmation disabled until exactly five offered cards are selected', async () => {
    const onToggleCard = vi.fn()
    render(<HandSelectionPanel view={view} selectedCardInstanceIds={['card-1', 'card-2', 'card-3', 'card-4']} submitPhase={{ kind: 'idle' }} onToggleCard={onToggleCard} onConfirm={vi.fn()} onDismissRejection={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Confirm five cards' })).toBeDisabled()
    await userEvent.click(screen.getAllByRole('button', { name: /Offer · Push/ })[0])
    expect(onToggleCard).toHaveBeenCalledWith('card-5')
  })

  it('shows the accepted server hand rather than a local draft', () => {
    render(<HandSelectionPanel view={{ kind: 'accepted', eraNumber: 2, cards: view.cards.slice(0, 5) }} selectedCardInstanceIds={[]} submitPhase={{ kind: 'submitted' }} onToggleCard={vi.fn()} onConfirm={vi.fn()} onDismissRejection={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Your accepted hand' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm five cards' })).not.toBeInTheDocument()
  })
})
