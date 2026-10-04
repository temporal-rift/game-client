import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { toBoardView } from '../board/boardView'
import type { DeclarationView } from '../declaration/declarationView'
import type { DeclarationSession, DeclarationSubmitPhase } from '../declaration/useDeclaration'
import type { HandSelectionSession } from '../hand/useHandSelection'
import { gameStatePayload } from '../test/gameStatePayload'
import { PhaseGuide } from './PhaseGuide'

function declarationSession(submitPhase: DeclarationSubmitPhase, view: DeclarationView = {
  kind: 'open', gameId: 'game', eraNumber: 1, deadline: null, eligibleModes: ['RALLY'], activeEvents: [],
}): DeclarationSession {
  return {
    view, submitPhase, draft: { kind: 'none' },
    selectMode: vi.fn(), selectTarget: vi.fn(), clearDraft: vi.fn(), dismissRejection: vi.fn(),
    skip: vi.fn().mockResolvedValue(undefined), confirm: vi.fn().mockResolvedValue(undefined),
  }
}

describe('PhaseGuide', () => {
  it.each([
    ['ACTION_ROUND_1', /Round 1: choose one action/, /Round 2/],
    ['ACTION_ROUND_2', /Round 2: choose one action/, /bands appear before Round 3/],
    ['ACTION_ROUND_3', /Round 3: choose one action/, /separate reaction phase/],
    ['PARADOX_RESOLUTION', /React to the paradox/, /scores are evaluated/],
    ['RESOLUTION', /Resolving this era/, /outcomes and scores follow/],
    ['ERA_END', /Review this era/, /A new era begins/],
    ['LOBBY', /Waiting for the game/, /The host starts/],
    ['ERA_START', /Preparing the next era/, /choose five cards/],
    ['GAME_ENDED', /The game has ended/, /Return to the lobby/],
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

  it.each([
    [{ kind: 'idle' }, /As an Activist, you may publicly back/],
    [{ kind: 'skipped' }, /You declined the declaration/],
    [{ kind: 'submitting' }, /Your decision is being submitted/],
    [{ kind: 'declining' }, /Your decline is being submitted/],
    [{ kind: 'awaiting-projection' }, /Your declaration is being reconciled/],
    [{ kind: 'decline-unknown', message: 'Lost response' }, /Use Retry decline/],
  ] satisfies readonly (readonly [DeclarationSubmitPhase, RegExp])[])('explains declaration status %j', (submitPhase, message) => {
    const view = toBoardView(gameStatePayload({ phase: 'ERA_START', phaseContext: { declarationOpen: true, paradoxOpen: false } }), null)
    render(<PhaseGuide view={view} declaration={declarationSession(submitPhase)} />)
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it('explains that an accepted declaration already uses Round 1', () => {
    const view = toBoardView(gameStatePayload({ phase: 'ERA_START', phaseContext: { declarationOpen: true, paradoxOpen: false } }), null)
    render(<PhaseGuide view={view} declaration={declarationSession({ kind: 'idle' }, { kind: 'submitted', eraNumber: 1, deadline: null })} />)
    expect(screen.getByText(/Your declaration is accepted and counts as your Round 1 action/)).toBeInTheDocument()
  })

  it('asks players with an accepted hand to wait for the others', () => {
    const handSelection: HandSelectionSession = {
      view: { kind: 'accepted', eraNumber: 1, cards: [] }, selectedCardInstanceIds: [], submitPhase: { kind: 'idle' },
      toggleCard: vi.fn(), confirm: vi.fn().mockResolvedValue(undefined), dismissRejection: vi.fn(),
    }
    render(<PhaseGuide view={toBoardView(gameStatePayload({ phase: 'HAND_SELECTION' }), null)} handSelection={handSelection} />)
    expect(screen.getByText(/Your five cards are kept. Wait for the other players/)).toBeInTheDocument()
  })
})
