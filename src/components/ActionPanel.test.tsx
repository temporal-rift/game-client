import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActionPanel } from './ActionPanel'
import type { ActionRoundView } from '../action/actionView'
import type { ActionDraft, SubmitPhase } from '../action/useActionSubmission'

const openView: Extract<ActionRoundView, { kind: 'open' }> = {
  kind: 'open',
  gameId: 'game-1',
  eraNumber: 2,
  roundNumber: 1,
  hasSubmitted: false,
  submittedCount: 1,
  totalPlayers: 3,
  deadline: '2030-01-01T00:00:00Z',
  hand: [
    {
      cardInstanceId: 'card-1',
      cardType: 'PUSH',
      grade: 'II',
      name: 'Push',
      effectSummary: "Increases the targeted outcome's probability; higher grades push harder.",
      targetMode: 'EVENT_OUTCOME',
      targetListSize: null,
      isPlayableThisRound: true,
    },
    {
      cardInstanceId: 'card-2',
      cardType: 'TRACE',
      grade: 'I',
      name: 'Trace',
      effectSummary: "Reveals who influenced an event's probability; higher grades cover more events.",
      targetMode: 'EVENT_OUTCOME',
      targetListSize: null,
      isPlayableThisRound: false,
    },
    {
      cardInstanceId: 'card-decoy',
      cardType: 'DECOY',
      grade: 'I',
      name: 'Decoy',
      effectSummary: 'Declares a disguise category with no other effect; the round summary shows the disguise.',
      targetMode: 'DISGUISE',
      targetListSize: null,
      isPlayableThisRound: true,
    },
  ],
  specials: [
    {
      specialAction: 'ANNIHILATE',
      name: 'Annihilate',
      effectSummary: 'Removes a targeted outcome from an event entirely.',
      targetMode: 'EVENT_OUTCOME',
      available: true,
      unavailableReason: null,
      remainingUsesThisEra: 1,
      remainingUsesThisGame: 1,
    },
    {
      specialAction: 'CASCADE',
      name: 'Cascade',
      effectSummary: 'Automatically carries an erasure forward into next era.',
      targetMode: 'NONE',
      available: false,
      unavailableReason: 'Jammed until round 1.',
      remainingUsesThisEra: null,
      remainingUsesThisGame: null,
    },
  ],
  activeEvents: [
    {
      eventId: 'evt-1',
      title: 'The Reactor',
      carryOverState: 'FRESH',
      outcomes: [
        { outcomeId: 'out-1', description: 'Succeeds' },
        { outcomeId: 'out-2', description: 'Fails' },
      ],
    },
  ],
  opponents: [{ playerId: 'p-2', playerName: 'Nora', isConnected: true }],
}

const idleDraft: ActionDraft = { kind: 'none' }
const idlePhase: SubmitPhase = { kind: 'idle' }

function noop() {}

describe('ActionPanel', () => {
  it('shows an unavailable message outside an open action round', () => {
    render(
      <ActionPanel
        view={{ kind: 'unavailable', reason: 'No action round is currently open.' }}
        draft={idleDraft}
        submitPhase={idlePhase}
        onSelectCard={noop}
        onSelectSpecial={noop}
        onClearDraft={noop}
        onConfirm={noop}
        onDismissRejection={noop}
      />,
    )
    expect(screen.getByText('No action round is currently open.')).toBeInTheDocument()
  })

  it('shows every legal card and special with grade, effect and availability', () => {
    const { container } = render(
      <ActionPanel
        view={openView}
        draft={idleDraft}
        submitPhase={idlePhase}
        onSelectCard={noop}
        onSelectSpecial={noop}
        onClearDraft={noop}
        onConfirm={noop}
        onDismissRejection={noop}
      />,
    )
    expect(screen.getByRole('button', { name: /Push · Grade II/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Trace · Grade I/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Annihilate' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cascade' })).toBeDisabled()
    expect(screen.getByText(/Jammed until round 1/)).toBeInTheDocument()
    expect(screen.getByText('1 / 3 players submitted.')).toBeInTheDocument()
    expect(screen.getByText(/remaining$/)).toBeInTheDocument()
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(5)
    expect(screen.getByRole('button', { name: /Push · Grade II/ }).querySelector('svg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Annihilate' }).querySelector('svg')).toBeInTheDocument()
  })

  it('keeps missing progress and deadline unavailable', () => {
    render(
      <ActionPanel
        view={{ ...openView, submittedCount: null, totalPlayers: null, deadline: null }}
        draft={idleDraft}
        submitPhase={idlePhase}
        onSelectCard={noop}
        onSelectSpecial={noop}
        onClearDraft={noop}
        onConfirm={noop}
        onDismissRejection={noop}
      />,
    )

    expect(screen.getByText('Round progress is being refreshed.')).toBeInTheDocument()
    expect(screen.getByText('Deadline is being refreshed.')).toBeInTheDocument()
  })

  it('shows event artwork when an event is offered as an action target and preserves its title', async () => {
    const { container } = render(
      <ActionPanel
        illustrationSkin="engraving"
        view={openView}
        draft={{ kind: 'card', cardInstanceId: 'card-1', coordinates: {} }}
        submitPhase={idlePhase}
        onSelectCard={noop}
        onSelectSpecial={noop}
        onClearDraft={noop}
        onConfirm={noop}
        onDismissRejection={noop}
      />,
    )
    const eventButton = screen.getByRole('button', { name: /The Reactor/ })
    expect(eventButton.querySelector('svg')).toHaveClass('skin-engraving')
    expect(container).toHaveTextContent('The Reactor')
  })

  it('selects a card, then an event, then an outcome, enabling confirm only once complete', async () => {
    const user = userEvent.setup()
    const onSelectCard = vi.fn()
    const { rerender } = render(
      <ActionPanel
        view={openView}
        draft={idleDraft}
        submitPhase={idlePhase}
        onSelectCard={onSelectCard}
        onSelectSpecial={noop}
        onClearDraft={noop}
        onConfirm={noop}
        onDismissRejection={noop}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Push · Grade II/ }))
    expect(onSelectCard).toHaveBeenCalledWith('card-1', {})

    const selectedDraft: ActionDraft = { kind: 'card', cardInstanceId: 'card-1', coordinates: {} }
    rerender(
      <ActionPanel
        view={openView}
        draft={selectedDraft}
        submitPhase={idlePhase}
        onSelectCard={onSelectCard}
        onSelectSpecial={noop}
        onClearDraft={noop}
        onConfirm={noop}
        onDismissRejection={noop}
      />,
    )

    expect(screen.getByRole('button', { name: 'Confirm action' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'The Reactor' }))
    expect(onSelectCard).toHaveBeenLastCalledWith('card-1', { targetEventId: 'evt-1' })

    rerender(
      <ActionPanel
        view={openView}
        draft={{ kind: 'card', cardInstanceId: 'card-1', coordinates: { targetEventId: 'evt-1' } }}
        submitPhase={idlePhase}
        onSelectCard={onSelectCard}
        onSelectSpecial={noop}
        onClearDraft={noop}
        onConfirm={noop}
        onDismissRejection={noop}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Succeeds' }))
    expect(onSelectCard).toHaveBeenLastCalledWith('card-1', { targetEventId: 'evt-1', targetOutcomeId: 'out-1' })
  })

  describe('Nullify player list', () => {
    const nullifyView: Extract<ActionRoundView, { kind: 'open' }> = {
      ...openView,
      hand: [
        {
          cardInstanceId: 'card-n',
          cardType: 'NULLIFY',
          grade: 'II',
          name: 'Nullify',
          effectSummary: "Cancels each named player's eligible action this round; grade II names two players.",
          targetMode: 'PLAYER_LIST',
          targetListSize: 2,
          isPlayableThisRound: true,
        },
      ],
      opponents: [
        { playerId: 'p-2', playerName: 'Nora', isConnected: true },
        { playerId: 'p-3', playerName: 'Ivo', isConnected: true },
        { playerId: 'p-4', playerName: 'Lia', isConnected: true },
      ],
    }

    function renderNullify(targetPlayerIds?: string[]) {
      const onSelectCard = vi.fn()
      render(
        <ActionPanel
          view={nullifyView}
          draft={{ kind: 'card', cardInstanceId: 'card-n', coordinates: targetPlayerIds ? { targetPlayerIds } : {} }}
          submitPhase={idlePhase}
          onSelectCard={onSelectCard}
          onSelectSpecial={noop}
          onClearDraft={noop}
          onConfirm={noop}
          onDismissRejection={noop}
        />,
      )
      return onSelectCard
    }

    it('adds a chosen opponent to targetPlayerIds, never a scalar targetPlayerId', async () => {
      const user = userEvent.setup()
      const onSelectCard = renderNullify()
      expect(screen.getByText('Choose 2 players (0/2 selected)')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Nora' }))
      expect(onSelectCard).toHaveBeenLastCalledWith('card-n', { targetPlayerIds: ['p-2'] })
    })

    it('keeps a grade II Nullify unconfirmable until two distinct opponents are chosen', () => {
      renderNullify(['p-2'])
      expect(screen.getByRole('button', { name: 'Confirm action' })).toBeDisabled()
    })

    it('enables confirmation once two distinct opponents are chosen', () => {
      renderNullify(['p-2', 'p-3'])
      expect(screen.getByRole('button', { name: 'Confirm action' })).toBeEnabled()
    })

    it('removes an already chosen opponent when chosen again', async () => {
      const user = userEvent.setup()
      const onSelectCard = renderNullify(['p-2', 'p-3'])
      await user.click(screen.getByRole('button', { name: 'Nora' }))
      expect(onSelectCard).toHaveBeenLastCalledWith('card-n', { targetPlayerIds: ['p-3'] })
    })

    it('ignores a third opponent once the grade-sized list is full', async () => {
      const user = userEvent.setup()
      const onSelectCard = renderNullify(['p-2', 'p-3'])
      await user.click(screen.getByRole('button', { name: 'Lia' }))
      expect(onSelectCard).toHaveBeenLastCalledWith('card-n', { targetPlayerIds: ['p-2', 'p-3'] })
    })
  })

  it('shows a rejection message while preserving the current selection', () => {
    const draft: ActionDraft = { kind: 'card', cardInstanceId: 'card-1', coordinates: { targetEventId: 'evt-1', targetOutcomeId: 'out-1' } }
    render(
      <ActionPanel
        view={openView}
        draft={draft}
        submitPhase={{ kind: 'rejected', message: 'That target is not legal for this action.', code: '422-03' }}
        onSelectCard={noop}
        onSelectSpecial={noop}
        onClearDraft={noop}
        onConfirm={noop}
        onDismissRejection={noop}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('That target is not legal for this action.')
    expect(screen.getByRole('alert').textContent).toContain('preserved')
    expect(screen.getByRole('button', { name: 'Confirm action' })).toBeEnabled()
  })

  it('shows a submitted round as read-only, never exposing another player’s decision', () => {
    render(
      <ActionPanel
        view={{ ...openView, hasSubmitted: true }}
        draft={idleDraft}
        submitPhase={idlePhase}
        onSelectCard={noop}
        onSelectSpecial={noop}
        onClearDraft={noop}
        onConfirm={noop}
        onDismissRejection={noop}
      />,
    )
    expect(screen.getByText(/Your action is submitted/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Push/ })).not.toBeInTheDocument()
  })

  it('asks for a disguise category and no target when Decoy is selected', async () => {
    const user = userEvent.setup()
    const onSelectCard = vi.fn()
    const { rerender } = render(
      <ActionPanel
        view={openView}
        draft={idleDraft}
        submitPhase={idlePhase}
        onSelectCard={onSelectCard}
        onSelectSpecial={noop}
        onClearDraft={noop}
        onConfirm={noop}
        onDismissRejection={noop}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Decoy · Grade I/ }))
    expect(onSelectCard).toHaveBeenCalledWith('card-decoy', {})

    rerender(
      <ActionPanel
        view={openView}
        draft={{ kind: 'card', cardInstanceId: 'card-decoy', coordinates: {} }}
        submitPhase={idlePhase}
        onSelectCard={onSelectCard}
        onSelectSpecial={noop}
        onClearDraft={noop}
        onConfirm={noop}
        onDismissRejection={noop}
      />,
    )

    expect(screen.getByRole('button', { name: 'Confirm action' })).toBeDisabled()
    expect(screen.getByLabelText('Choose a disguise')).toBeInTheDocument()
    expect(screen.getAllByText(/choose a disguise/i)).toHaveLength(3)
    expect(screen.queryByLabelText('Choose a target')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Disruption' }))
    expect(onSelectCard).toHaveBeenLastCalledWith('card-decoy', { disguiseCategory: 'DISRUPTION' })
  })

  it('enables confirm once a Decoy disguise is chosen', () => {
    render(
      <ActionPanel
        view={openView}
        draft={{ kind: 'card', cardInstanceId: 'card-decoy', coordinates: { disguiseCategory: 'PARADOX' } }}
        submitPhase={idlePhase}
        onSelectCard={noop}
        onSelectSpecial={noop}
        onClearDraft={noop}
        onConfirm={noop}
        onDismissRejection={noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'Confirm action' })).toBeEnabled()
    expect(screen.getByText(/disguise selected/i)).toBeInTheDocument()
  })
})
