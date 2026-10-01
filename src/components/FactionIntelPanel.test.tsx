import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GameStateView } from '../api/projection'
import { toBoardView } from '../board/boardView'
import { baseGameState } from '../game/gameStateFixtures'
import { FactionIntelPanel } from './FactionIntelPanel'

function renderFaction(overrides: Partial<GameStateView>) {
  return render(<FactionIntelPanel faction={toBoardView(baseGameState(overrides), null).faction} />)
}

describe('FactionIntelPanel', () => {
  it('shows the own faction, score against the transmitted threshold, and each special with its uses', () => {
    const { container } = renderFaction({
      myFaction: 'PROPHETS',
      myScore: 8,
      winScoreThreshold: 20,
      mySpecialActions: ['SEAL', 'FORESIGHT'],
      mySpecialBudgets: [{ specialAction: 'SEAL', remainingUsesThisEra: 1, remainingUsesThisGame: 2 }],
    })

    expect(screen.getByText('Prophets')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('/ 20 to win')).toBeInTheDocument()
    const specials = screen.getByRole('list', { name: 'Faction special uses' })
    expect(specials).toHaveTextContent('Seal1 this era · 2 this game')
    expect(specials).toHaveTextContent('Foresight')
    expect(container.querySelector('.faction-emblem')).toBeInTheDocument()
  })

  it('says no faction is assigned and lists no specials before assignment', () => {
    renderFaction({ myFaction: null, mySpecialActions: [] })

    expect(screen.getByText('No faction assigned yet')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Faction special uses' })).not.toBeInTheDocument()
  })
})
