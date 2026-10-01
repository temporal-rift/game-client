import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { toBoardView } from '../board/boardView'
import { baseGameState } from '../game/gameStateFixtures'
import { PrivateHand } from './PrivateHand'

const hand = toBoardView(
  baseGameState({
    myHand: [
      { cardInstanceId: 'card-1', cardType: 'PUSH', grade: 'II', isPlayableThisRound: true },
      { cardInstanceId: 'card-2', cardType: 'SCAN', grade: 'I', isPlayableThisRound: false },
    ],
  }),
  null,
).hand

describe('PrivateHand', () => {
  it('renders each real card with its name, grade and artwork', () => {
    const { container } = render(<PrivateHand hand={hand} />)

    expect(screen.getByText('Push')).toBeInTheDocument()
    expect(screen.getByLabelText('Grade II')).toBeInTheDocument()
    expect(container.querySelector('.card-glyph-push')).toBeInTheDocument()
  })

  it('states round playability in text, not color alone', () => {
    render(<PrivateHand hand={hand} />)

    expect(screen.getByText('Playable')).toBeInTheDocument()
    expect(screen.getByText('Not playable this round')).toBeInTheDocument()
  })

  it('offers no selection controls until hand interaction moves onto the board', () => {
    render(<PrivateHand hand={hand} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
