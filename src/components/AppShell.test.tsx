import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { sampleFixturePlayerView } from '../fixtures/playerView'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('renders the event board, private hand, faction/intel and action confirmation regions', () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    expect(screen.getByRole('heading', { name: 'Event board' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Private hand' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Faction & intel' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Action confirmation' })).toBeInTheDocument()
  })

  it('labels fixture state as sample data', () => {
    render(<AppShell playerView={sampleFixturePlayerView} isSampleData />)

    expect(screen.getByRole('status')).toHaveTextContent('sample data')
  })
})
