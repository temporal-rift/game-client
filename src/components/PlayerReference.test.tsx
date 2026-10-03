import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CARD_TYPES, FACTIONS } from '../api/action'
import { CARD_REFERENCE, FACTION_REFERENCE } from '../reference/playerReference'
import { PlayerReference } from './PlayerReference'

describe('PlayerReference', () => {
  it('covers every card and faction from the contracts', () => {
    expect(Object.keys(CARD_REFERENCE).sort()).toEqual([...CARD_TYPES].sort())
    expect(Object.keys(FACTION_REFERENCE).sort()).toEqual([...FACTIONS].sort())
    render(<PlayerReference faction="ACTIVISTS" />)
    fireEvent.click(screen.getByRole('button', { name: 'Cards & factions' }))
    expect(screen.getAllByRole('article')).toHaveLength(CARD_TYPES.length + FACTIONS.length)
    expect(screen.getByText('Activists · Your faction')).toBeInTheDocument()
  })

  it('finds abilities within their faction and recovers an empty search', () => {
    render(<PlayerReference />)
    fireEvent.click(screen.getByRole('button', { name: 'Cards & factions' }))
    const search = screen.getByRole('searchbox')
    fireEvent.change(search, { target: { value: 'momentum' } })
    expect(screen.getByText('Momentum')).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'no-such-card' } })
    expect(screen.getByText(/No matching rules/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getAllByRole('article')).toHaveLength(CARD_TYPES.length + FACTIONS.length)
  })
})
