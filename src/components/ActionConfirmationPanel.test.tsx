import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EventBoardEntry, HandCard } from '../types/playerView'
import { ActionConfirmationPanel } from './ActionConfirmationPanel'

const card: HandCard = { id: 'card-1', name: 'Anchor Point', grade: 3, description: 'Stabilize an outcome.' }
const target: EventBoardEntry = {
  id: 'evt-2',
  era: 1,
  title: 'Convergence at the Vault',
  publicBand: '40 / 40 / 20',
  status: 'in-progress',
  isValidTarget: true,
}

describe('ActionConfirmationPanel', () => {
  it('announces summary updates in a live region without including the confirm button', () => {
    render(
      <ActionConfirmationPanel
        selectedCard={card}
        selectedTarget={target}
        confirmLabel="Confirm action"
        isSampleData
        onConfirm={vi.fn()}
      />,
    )

    const summary = screen.getByText(/Anchor Point \(grade 3\) → Convergence at the Vault/)
    expect(summary).toHaveAttribute('aria-live', 'polite')
    expect(summary).toHaveAttribute('aria-atomic', 'true')
    expect(summary).not.toContainElement(screen.getByRole('button', { name: 'Confirm action' }))
  })
})
