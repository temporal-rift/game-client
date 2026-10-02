import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { toBoardView } from '../board/boardView'
import { boardKnowledgeState } from '../test/boardKnowledgeState'
import { AppShell } from './AppShell'
import { EventBoard } from './EventBoard'
import { PlayerStrip } from './PlayerStrip'

const renderBoard = (state = boardKnowledgeState()) => render(<AppShell view={toBoardView(state, 'p-me')} status={{ kind: 'ready' }} onRetry={vi.fn()} />)

describe('knowledge on the board', () => {
  it('shows public bands and private exact values with age, expiry and flags at their outcomes', () => {
    renderBoard()
    const outcomes = within(screen.getByRole('list', { name: 'Reactor ignition outcomes' }))
    const [success, destruction] = outcomes.getAllByRole('listitem')
    expect(success).toHaveTextContent('PublicHigh')
    expect(success).toHaveTextContent('Private intelScan · 62% (sealed)')
    expect(success).toHaveTextContent('Observed round 2 · expires at the end of Era 2')
    expect(destruction).toHaveTextContent('Scan · 0% (annihilated)')
    const other = screen.getByRole('list', { name: 'Trade pact outcomes' })
    expect(other).not.toHaveTextContent(/\d+%|Private intel/)
  })

  it('lists all earned knowledge in the faction panel under the stable accessible name, preserving Trace and Intercept detail', () => {
    renderBoard()
    const list = screen.getByRole('list', { name: 'Your earned knowledge' })
    expect(list.closest('aside')).toHaveAccessibleName('Your faction')
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    expect(within(list).getAllByText('Private intel')).toHaveLength(4)
    expect(list).toHaveTextContent('Ignition succeeds: 62% (sealed)')
    expect(list).toHaveTextContent('Influenced by Bo (Revisionist via Mimic), Cy')
    expect(list).toHaveTextContent('No player influenced this event.')
    expect(list).toHaveTextContent('Intercept · CyScan · Grade II')
    expect(list).not.toHaveTextContent('Cy (Revisionist via Mimic)')
    expect(list).not.toHaveTextContent('Public intel')
    expect(within(list).getAllByText(/Observed round (1|2) · expires at the end of Era 2/)).toHaveLength(4)
  })

  it('marks Rally and Momentum declarations public on the declaring player and exact outcome', () => {
    renderBoard()
    const players = screen.getByRole('region', { name: 'Player scores' })
    const bo = within(players).getByText('Bo').closest('li')!
    const cy = within(players).getByText('Cy').closest('li')!
    expect(bo).toHaveTextContent('Public intelBo · RallyReactor ignition → Ignition succeedsEra 2')
    expect(cy).toHaveTextContent('Public intelCy · MomentumTrade pact → RenegotiationEra 2')
    expect(players).not.toHaveTextContent('Private intel')
    const outcomes = screen.getByRole('list', { name: 'Reactor ignition outcomes' })
    expect(within(outcomes).getAllByRole('listitem')[0]).toHaveTextContent('Bo · Rally')
    expect(within(outcomes).getAllByRole('listitem')[1]).not.toHaveTextContent('Rally')
    expect(screen.getByRole('list', { name: 'Trade pact outcomes' })).toHaveTextContent('Cy · Momentum')
  })

  it('places public Expose facts on the target and signature event, without prematurely claiming a Round 3 result', () => {
    renderBoard(boardKnowledgeState({ roundNumber: 2, phase: 'ACTION_ROUND_2', exposeFacts: boardKnowledgeState().exposeFacts?.slice(0, 1) }))
    const players = screen.getByRole('region', { name: 'Player scores' })
    expect(within(players).getByText('Cy').closest('li')).toHaveTextContent('Public intelBo exposed CySwing · Reactor ignitionRound 2')
    expect(within(players).getByText('Bo').closest('li')).not.toHaveTextContent('exposed')
    const reactor = screen.getByRole('heading', { name: 'Reactor ignition' }).closest('li')!
    expect(reactor).toHaveTextContent('Public intelBo exposed Cy')
    expect(screen.getByRole('heading', { name: 'Trade pact' }).closest('li')).not.toHaveTextContent('exposed')
    expect(screen.queryByText(/Behavior (changed|unchanged) in Round 3/)).not.toBeInTheDocument()
  })

  it.each([true, false])('shows only the returned Round 3 behavior fact (%s) on the player', (behaviorChanged) => {
    renderBoard(boardKnowledgeState({ exposeFacts: [{ activistPlayerId: 'p-bo', targetPlayerId: 'p-cy', roundNumber: 3, behaviorChanged }] }))
    const players = screen.getByRole('region', { name: 'Player scores' })
    expect(players).toHaveTextContent(behaviorChanged ? 'Behavior changed in Round 3' : 'Behavior unchanged in Round 3')
    expect(players).not.toHaveTextContent('Swing')
    expect(screen.getByRole('heading', { name: 'Reactor ignition' }).closest('li')).not.toHaveTextContent('exposed')
  })

  it('keeps repeated private Trace observations beside their event and out of public player observations', () => {
    renderBoard()
    const reactor = screen.getByRole('heading', { name: 'Reactor ignition' }).closest('li')!
    expect(within(reactor).getByText('Influenced by Bo (Revisionist via Mimic), Cy')).toBeInTheDocument()
    expect(within(reactor).getByText('No player influenced this event.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Player scores' })).not.toHaveTextContent('Mimic')
  })

  it('renders no category placeholders or sample knowledge when nothing is returned', () => {
    renderBoard(boardKnowledgeState({ myRevealedIntel: [], publicBands: [], declarations: [], exposeFacts: [] }))
    expect(screen.queryByRole('list', { name: 'Your earned knowledge' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Private intel|Public intel|No public bands|not bought|No Rally|No Expose|sample/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Public', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your earned knowledge' })).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Reactor ignition outcomes' })).not.toHaveTextContent(/\d+%/)
  })

  it('removes previous private knowledge when the server clears it at era end or the caller changes perspective', () => {
    const state = boardKnowledgeState()
    const { rerender } = renderBoard(state)
    expect(screen.getByRole('list', { name: 'Your earned knowledge' })).toBeInTheDocument()
    rerender(<AppShell view={toBoardView({ ...state, eraNumber: 3, myRevealedIntel: [] }, 'p-bo')} status={{ kind: 'ready' }} onRetry={vi.fn()} />)
    expect(screen.queryByRole('list', { name: 'Your earned knowledge' })).not.toBeInTheDocument()
    expect(screen.queryByText('Private intel')).not.toBeInTheDocument()
    expect(screen.queryByText(/62%|Mimic/)).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Player scores' })).toHaveTextContent('Public intelBo · Rally')
  })

  it('keeps outcome and player targeting usable with contextual observations and no nested buttons', async () => {
    const user = userEvent.setup()
    const view = toBoardView(boardKnowledgeState(), 'p-me')
    const onPickOutcome = vi.fn()
    const onPickPlayer = vi.fn()
    const { container } = render(<>
      <EventBoard events={view.events} targeting={{ targetMode: 'EVENT_OUTCOME', coordinates: { targetEventId: 'event-1' }, disabled: false, onPickEvent: vi.fn(), onPickOutcome }} />
      <PlayerStrip players={view.players} targeting={{ targetMode: 'PLAYER', coordinates: {}, disabled: false, opponents: [{ playerId: 'p-cy', playerName: 'Cy', isConnected: true }], onPickPlayer }} />
    </>)
    await user.click(screen.getByRole('button', { name: /Ignition succeeds/ }))
    expect(onPickOutcome).toHaveBeenCalledWith('event-1', 'outcome-1')
    await user.click(screen.getByRole('button', { name: /Cy/ }))
    expect(onPickPlayer).toHaveBeenCalledWith('p-cy')
    expect(container.querySelector('button button')).toBeNull()
    expect(screen.getByRole('button', { name: /Cy/ })).not.toHaveTextContent('Public intel')
  })

  it.each([false, true])('keeps knowledge visible during paradox resolution with targeting %s', async (targeting) => {
    const user = userEvent.setup()
    const view = toBoardView(boardKnowledgeState(), 'p-me')
    const onPickOutcome = vi.fn()
    render(<EventBoard events={view.events} paradox={{
      affectedEventIds: new Set(['event-1']),
      paradoxes: [{ paradoxId: 'paradox-1', type: 'DEAD_HEAT', typeLabel: 'Dead Heat', affectedEventId: 'event-1', affectedOutcomeIds: ['outcome-1'] }],
      targeting: targeting ? { chosen: null, disabled: false, onPickOutcome } : null,
    }} />)
    const outcomes = screen.getByRole('list', { name: 'Reactor ignition outcomes' })
    const success = within(outcomes).getAllByRole('listitem')[0]
    expect(success).toHaveTextContent('Affected')
    expect(success).toHaveTextContent('Private intelScan · 62% (sealed)')
    expect(success).toHaveTextContent('Public intelBo · Rally')
    expect(screen.getByText('Influenced by Bo (Revisionist via Mimic), Cy')).toBeInTheDocument()
    expect(screen.getByText('Bo exposed Cy')).toBeInTheDocument()
    expect(screen.queryByText('No public bands yet')).not.toBeInTheDocument()
    if (targeting) {
      await user.click(within(outcomes).getByRole('button', { name: /Ignition succeeds/ }))
      expect(onPickOutcome).toHaveBeenCalledWith('event-1', 'outcome-1')
    } else {
      expect(within(outcomes).queryByRole('button')).not.toBeInTheDocument()
    }
  })
})
