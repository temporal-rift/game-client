import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RoundSummaryView } from '../round-summary/roundSummaryView'
import { RoundSummaryPanel } from './RoundSummaryPanel'

describe('RoundSummaryPanel', () => {
  it('shows an unavailable message before the first round closes', () => {
    render(<RoundSummaryPanel view={{ kind: 'unavailable', reason: 'No round has closed yet.' }} />)
    expect(screen.getByText('No round has closed yet.')).toBeInTheDocument()
  })

  it('shows category and family for cards, family only for specials, and neither for skips', () => {
    const view: RoundSummaryView = {
      kind: 'ready',
      gameId: 'game-1',
      eraNumber: 2,
      roundNumber: 1,
      entries: [
        {
          kind: 'card',
          playerId: 'p-1',
          playerName: 'Nora',
          actionFamily: 'CARD',
          familyLabel: 'Card',
          actionCategory: 'PROBABILITY_SHIFTER',
          categoryLabel: 'Probability shifter',
        },
        { kind: 'special', playerId: 'p-2', playerName: 'Eli' },
        { kind: 'skipped', playerId: 'p-3', playerName: 'Mara' },
      ],
    }
    render(<RoundSummaryPanel view={view} />)
    expect(screen.getByText(/Nora/)).toBeInTheDocument()
    expect(screen.getByText(/Probability shifter/)).toBeInTheDocument()
    expect(screen.getByText(/Card/)).toBeInTheDocument()
    expect(screen.getByText(/Eli/)).toBeInTheDocument()
    expect(screen.getByText(/Special/)).toBeInTheDocument()
    expect(screen.getByText(/Mara/)).toBeInTheDocument()
    expect(screen.getByText(/Skipped/)).toBeInTheDocument()
  })

  it('never renders a card type, grade, or target', () => {
    const view: RoundSummaryView = {
      kind: 'ready',
      gameId: 'game-1',
      eraNumber: 2,
      roundNumber: 1,
      entries: [
        {
          kind: 'card',
          playerId: 'p-1',
          playerName: 'Nora',
          actionFamily: 'CARD',
          familyLabel: 'Card',
          actionCategory: 'DISRUPTION',
          categoryLabel: 'Disruption',
        },
      ],
    }
    const { container } = render(<RoundSummaryPanel view={view} />)
    expect(container.textContent).not.toMatch(/DECOY|PUSH|SWING|Grade/)
  })
})
