import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toBoardView } from '../board/boardView'
import { baseGameState } from '../game/gameStateFixtures'
import type { HandSelectionSession } from '../hand/useHandSelection'
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

const openOffer: Extract<HandSelectionSession['view'], { kind: 'open' }> = {
  kind: 'open',
  gameId: 'game-1',
  eraNumber: 2,
  requiredSelectionCount: 5,
  expiresAt: '2026-10-02T10:01:30Z',
  cards: Array.from({ length: 7 }, (_, index) => ({
    cardInstanceId: `offer-${index + 1}`,
    cardType: 'PUSH',
    grade: index === 0 ? 'III' : 'II',
    dealSlot: index + 1,
    name: 'Push',
    effectSummary: 'Raises one outcome.',
  })),
}

function selection(overrides: Partial<HandSelectionSession> = {}): HandSelectionSession {
  return {
    view: openOffer,
    selectedCardInstanceIds: [],
    submitPhase: { kind: 'idle' },
    toggleCard: vi.fn(),
    confirm: vi.fn(async () => {}),
    dismissRejection: vi.fn(),
    ...overrides,
  }
}

describe('PrivateHand', () => {
  afterEach(() => vi.useRealTimers())

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

  it('keeps the final hand read-only when no selection window is open', () => {
    render(<PrivateHand hand={hand} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('shows the private seven-card offer, its grades, and its server deadline on the board', () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-10-02T10:00:00Z'))

    const { container } = render(<PrivateHand hand={hand} handSelection={selection()} />)

    expect(screen.getByRole('region', { name: 'Hand selection' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Private card offer' })).toHaveAttribute('aria-label', 'Private card offer')
    expect(screen.getByLabelText('Grade III')).toBeInTheDocument()
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('1:30')
    expect(container.querySelectorAll('.card-glyph-push')).toHaveLength(7)
  })

  it('requires exactly five offered cards before confirmation and preserves the existing control name', async () => {
    const onToggleCard = vi.fn()
    const onConfirm = vi.fn(async () => {})
    const first = selection({
      selectedCardInstanceIds: ['offer-1', 'offer-2', 'offer-3', 'offer-4'],
      toggleCard: onToggleCard,
      confirm: onConfirm,
    })
    const { rerender } = render(<PrivateHand hand={hand} handSelection={first} />)

    expect(screen.getByRole('button', { name: 'Confirm five cards' })).toBeDisabled()
    await userEvent.click(screen.getAllByRole('button', { name: /Offer · Push · Grade II/ })[0])
    expect(onToggleCard).toHaveBeenCalledWith('offer-5')

    rerender(
      <PrivateHand
        hand={hand}
        handSelection={selection({ selectedCardInstanceIds: ['offer-1', 'offer-2', 'offer-3', 'offer-4', 'offer-5'], confirm: onConfirm })}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Confirm five cards' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('shows a rejection on the board and keeps the offer editable', async () => {
    const onToggleCard = vi.fn()
    const onDismissRejection = vi.fn()
    render(
      <PrivateHand
        hand={hand}
        handSelection={selection({
          submitPhase: { kind: 'rejected', message: 'That offer has changed.', code: '409-08' },
          toggleCard: onToggleCard,
          dismissRejection: onDismissRejection,
        })}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('That offer has changed.')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismissRejection).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: /Offer · Push · Grade III/ }))
    expect(onToggleCard).toHaveBeenCalledWith('offer-1')
  })

  it('shows the authoritative final hand without pending-offer controls after selection recovery', () => {
    const accepted: HandSelectionSession = selection({
      view: { kind: 'accepted', eraNumber: 2, cards: openOffer.cards.slice(0, 5) },
      submitPhase: { kind: 'submitted' },
    })
    render(<PrivateHand hand={hand} handSelection={accepted} />)

    expect(screen.getByText('Your hand')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Hand selection' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm five cards' })).not.toBeInTheDocument()
  })
})
