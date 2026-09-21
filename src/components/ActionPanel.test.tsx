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
  hand: [
    {
      cardInstanceId: 'card-1',
      cardType: 'PUSH',
      grade: 'II',
      name: 'Push',
      effectSummary: "Increases the targeted outcome's probability; higher grades push harder.",
      targetMode: 'EVENT_OUTCOME',
      isPlayableThisRound: true,
    },
    {
      cardInstanceId: 'card-2',
      cardType: 'TRACE',
      grade: 'I',
      name: 'Trace',
      effectSummary: "Reveals who influenced an event's probability; higher grades cover more events.",
      targetMode: 'EVENT_OUTCOME',
      isPlayableThisRound: false,
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
    render(
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
})
