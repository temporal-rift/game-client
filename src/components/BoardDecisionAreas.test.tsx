import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DeclarationSession } from '../declaration/useDeclaration'
import { BoardDecisionAreas } from './BoardDecisionAreas'

const event = { eventId: 'event-1', title: 'Reactor ignition', carryOverState: 'FRESH' as const, outcomes: [{ outcomeId: 'outcome-1', description: 'Ignition succeeds' }] }

function declarationSession(): DeclarationSession {
  return {
    view: { kind: 'open', gameId: 'game-1', eraNumber: 2, deadline: null, eligibleModes: ['RALLY'], activeEvents: [event] },
    draft: { kind: 'declaration', mode: 'RALLY', targetEventId: 'event-1', targetOutcomeId: 'outcome-1' },
    submitPhase: { kind: 'rejected', message: 'Choose again.', code: null },
    selectMode: vi.fn(), selectTarget: vi.fn(), clearDraft: vi.fn(), skip: vi.fn(), confirm: vi.fn(async () => {}), dismissRejection: vi.fn(),
  }
}

describe('BoardDecisionAreas', () => {
  it('keeps every declaration callback available within a styled board area', () => {
    const declaration = declarationSession()
    render(<BoardDecisionAreas declaration={declaration} />)
    const region = screen.getByRole('region', { name: 'Declaration window' })
    expect(region.parentElement).toHaveClass('board-decision-area')
    fireEvent.click(within(region).getByRole('button', { name: 'Rally' }))
    fireEvent.click(within(region).getByRole('button', { name: 'Ignition succeeds' }))
    fireEvent.click(within(region).getByRole('button', { name: 'Confirm declaration' }))
    fireEvent.click(within(region).getByRole('button', { name: 'Clear selection' }))
    fireEvent.click(within(region).getByRole('button', { name: /decline/i }))
    fireEvent.click(within(region).getByRole('button', { name: 'Dismiss' }))
    expect(declaration.selectMode).toHaveBeenCalledWith('RALLY')
    expect(declaration.selectTarget).toHaveBeenCalledWith('event-1', 'outcome-1')
    expect(declaration.confirm).toHaveBeenCalledOnce()
    expect(declaration.clearDraft).toHaveBeenCalledOnce()
    expect(declaration.skip).toHaveBeenCalledOnce()
    expect(declaration.dismissRejection).toHaveBeenCalledOnce()
  })

  it('shows no empty areas when the player has no declaration decision', () => {
    const { container } = render(<BoardDecisionAreas
      declaration={{ ...declarationSession(), view: { kind: 'unavailable', reason: 'Window closed.' } }}
    />)
    expect(container).toBeEmptyDOMElement()
  })
})
