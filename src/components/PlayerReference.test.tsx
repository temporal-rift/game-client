import { fireEvent, render, screen, within } from '@testing-library/react'
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

  it('describes the contested-yield rules in the rendered reference', () => {
    render(<PlayerReference />)
    fireEvent.click(screen.getByRole('button', { name: 'Cards & factions' }))
    const articleFor = (heading: string) => {
      const article = screen.getByRole('heading', { name: heading }).closest('article')
      if (!article) throw new Error(`expected an article for ${heading}`)
      return article
    }

    const revisionists = articleFor('Revisionists')
    expect(within(revisionists).getByText(/first Rewrite of the era is your locked preference and cannot be changed/)).toBeInTheDocument()
    expect(within(revisionists).getByText(/playable only in Rounds 1 and 2 by default/)).toBeInTheDocument()
    expect(within(revisionists).getAllByText(/a miss costs points/).length).toBeGreaterThan(0)
    expect(within(revisionists).queryByText(/replacing any earlier preference|replaces your previous preference/i)).not.toBeInTheDocument()

    const activists = articleFor('Activists')
    expect(
      within(activists).getByText(/Expose earns points only when the revealed signature is on the event of your own declaration that era/),
    ).toBeInTheDocument()

    const erasers = articleFor('Erasers')
    expect(within(erasers).getAllByText(/A leading erasure scores only when it changed which outcome won/).length).toBeGreaterThan(0)
  })
})
