import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { toBoardView } from '../board/boardView'
import { gameStatePayload } from '../test/gameStatePayload'
import { PhaseGuide } from './PhaseGuide'

describe('PhaseGuide', () => {
  it.each([
    ['ACTION_ROUND_1', /Round 1: choose one action/, /Round 2/],
    ['ACTION_ROUND_2', /Round 2: choose one action/, /bands appear before Round 3/],
    ['ACTION_ROUND_3', /Round 3: choose one action/, /separate reaction phase/],
    ['PARADOX_RESOLUTION', /React to the paradox/, /scores are evaluated/],
    ['RESOLUTION', /Resolving this era/, /outcomes and scores follow/],
    ['ERA_END', /Review this era/, /A new era begins/],
  ] as const)('explains %s and what follows', (phase, heading, next) => {
    const roundNumber = phase === 'ACTION_ROUND_1' ? 1 : phase === 'ACTION_ROUND_3' ? 3 : 2
    render(<PhaseGuide view={toBoardView(gameStatePayload({ phase, roundNumber }), null)} />)
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByText(next)).toBeInTheDocument()
  })

  it('shows server confirmation while a decision is pending', () => {
    render(<PhaseGuide view={toBoardView(gameStatePayload({ phase: 'ACTION_ROUND_2', roundNumber: 2 }), null)} decisionPending />)
    expect(screen.getByText(/Waiting for the server to confirm/)).toBeInTheDocument()
  })

  it('explains that ineligible callers wait during declarations', () => {
    render(<PhaseGuide view={toBoardView(gameStatePayload({ phase: 'ERA_START', phaseContext: { declarationOpen: true, paradoxOpen: false } }), null)} />)
    expect(screen.getByText(/You do not need to act in this phase/)).toBeInTheDocument()
    expect(screen.getByText(/Round 1 opens when declaration decisions/)).toBeInTheDocument()
  })

  it('explains hand selection and its timeout consequence', () => {
    render(<PhaseGuide view={toBoardView(gameStatePayload({ phase: 'HAND_SELECTION' }), null)} />)
    expect(screen.getByText(/Read the seven offered cards/)).toBeInTheDocument()
    expect(screen.getByText(/five cards are kept at random/)).toBeInTheDocument()
  })
})
