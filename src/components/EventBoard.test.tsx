import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ActiveEvent } from '../api/projection'
import { toBoardView } from '../board/boardView'
import { baseGameState } from '../game/gameStateFixtures'
import { EVENT_CATALOG } from '../illustrations/catalogData'
import { EventBoard } from './EventBoard'

const ACTIVE_EVENTS: ActiveEvent[] = [
  {
    eventId: '12606191-eafe-4d1c-a014-b676bf094db0',
    title: 'Delegate Event',
    carryOverState: 'FRESH',
    outcomes: [{ outcomeId: 'delegate-outcome', description: 'Delegate branch', initialProbability: 100 }],
  },
  {
    eventId: EVENT_CATALOG[3][0],
    title: 'Cascaded Event',
    carryOverState: 'CASCADED',
    outcomes: [{ outcomeId: 'cascaded-outcome', description: 'Cascaded branch', initialProbability: 100 }],
  },
  {
    eventId: 'unknown-event-id',
    title: 'Unobserved Event',
    carryOverState: 'STALLED',
    outcomes: [{ outcomeId: 'hidden-outcome', description: 'Unobserved branch', initialProbability: 100 }],
  },
]

function boardEvents(skin?: 'board' | 'engraving') {
  const state = baseGameState({
    activeEvents: ACTIVE_EVENTS,
    publicBands: [
      { eventId: ACTIVE_EVENTS[0].eventId, observedInRound: 2, outcomes: [{ outcomeId: 'delegate-outcome', band: 'HIGH' }] },
      { eventId: ACTIVE_EVENTS[1].eventId, observedInRound: 1, outcomes: [{ outcomeId: 'cascaded-outcome', band: 'LOW' }] },
    ],
  })
  return render(<EventBoard events={toBoardView(state, null).events} illustrationSkin={skin} />)
}

describe('EventBoard', () => {
  it('renders event titles, outcomes, carry-over state, public bands and each event band age', () => {
    boardEvents()

    expect(screen.getByRole('heading', { name: 'Delegate Event' })).toBeInTheDocument()
    expect(screen.getByText('Fresh')).toBeInTheDocument()
    expect(screen.getByText('Cascaded')).toBeInTheDocument()
    expect(screen.getByText('Stalled')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Delegate Event outcomes' })).getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Bands from round 2')).toBeInTheDocument()
    expect(screen.getByText('Bands from round 1')).toBeInTheDocument()
  })

  it('shows an unknown band and no age where none is published, never a number', () => {
    boardEvents()

    const outcomes = screen.getByRole('list', { name: 'Unobserved Event outcomes' })
    expect(outcomes).toHaveTextContent('Unknown')
    expect(outcomes).not.toHaveTextContent(/\d/)
    expect(screen.queryByText('No public bands yet')).not.toBeInTheDocument()
  })

  it('offers no target controls while nothing is being targeted', () => {
    boardEvents()

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('uses catalog illustrations for catalog and unknown event IDs', () => {
    const { container } = boardEvents()

    expect(container.querySelector('.catalog-event-scene-art')).toBeInTheDocument()
    expect(container.querySelector(`[data-catalog-id="${EVENT_CATALOG[3][0]}"]`)).toBeInTheDocument()
    expect(container.querySelector('[data-catalog-id="unknown-event-id"]')).toBeInTheDocument()
  })

  it('renders decorative artwork in the selected skin and keeps event titles readable', () => {
    const { container } = boardEvents('engraving')

    expect(container.querySelector('svg.skin-engraving')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Unobserved Event')).toBeInTheDocument()
  })
})
