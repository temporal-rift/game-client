import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { sampleFixturePlayerView } from '../fixtures/playerView'
import { FactionIntelPanel } from './FactionIntelPanel'

describe('FactionIntelPanel', () => {
  it('distinguishes private and public knowledge with readable scope and age', () => {
    render(<FactionIntelPanel faction={sampleFixturePlayerView.faction} />)

    expect(screen.getByText('Private intel')).toBeInTheDocument()
    expect(screen.getByText('Public intel')).toBeInTheDocument()
    expect(screen.getByText('Current era')).toBeInTheDocument()
    expect(screen.getByText('Round 2')).toBeInTheDocument()
  })
})
