import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { KnowledgeView } from '../knowledge/knowledgeView'
import { KnowledgePanel } from './KnowledgePanel'

const READY_VIEW: Extract<KnowledgeView, { kind: 'ready' }> = {
  kind: 'ready',
  gameId: 'game-1',
  eraNumber: 2,
  bands: [
    {
      eventId: 'event-1',
      eventTitle: 'The Delegate Arrives',
      observedInRound: 2,
      outcomes: [
        { outcomeId: 'outcome-1', outcomeDescription: 'Accepted', band: 'high' },
        { outcomeId: 'outcome-2', outcomeDescription: 'Rejected', band: 'unknown' },
      ],
    },
  ],
  revealedKnowledge: [
    {
      kind: 'PROBABILITY',
      eventId: 'event-1',
      eventTitle: 'The Delegate Arrives',
      observedInRound: 2,
      expiresAtEraEnd: 2,
      outcomes: [{ outcomeId: 'outcome-1', outcomeDescription: 'Accepted', probability: 62, isAnnihilated: false, isSealed: false }],
    },
  ],
  declarations: [
    {
      playerId: 'p-1',
      playerName: 'Nora',
      mode: 'RALLY',
      modeName: 'Rally',
      eventId: 'event-1',
      eventTitle: 'The Delegate Arrives',
      outcomeId: 'outcome-1',
      outcomeDescription: 'Accepted',
      eraNumber: 2,
    },
  ],
  exposeFacts: [
    {
      activistPlayerId: 'p-1',
      activistPlayerName: 'Nora',
      targetPlayerId: 'p-2',
      targetPlayerName: 'Eli',
      roundNumber: 2,
      signatureCardName: 'Swing',
      signatureEventTitle: 'The Delegate Arrives',
      behaviorChanged: false,
    },
  ],
}

const NO_ERROR_PROPS = { error: null, isRefreshing: false, onRefresh: vi.fn() }

describe('KnowledgePanel', () => {
  it('shows the unavailable reason before state has loaded', () => {
    render(<KnowledgePanel view={{ kind: 'unavailable', reason: 'Game state is not loaded yet.' }} {...NO_ERROR_PROPS} />)
    expect(screen.getByText('Game state is not loaded yet.')).toBeInTheDocument()
  })

  it('distinguishes public bands from private earned knowledge by scope, age and expiry', () => {
    render(<KnowledgePanel view={READY_VIEW} {...NO_ERROR_PROPS} />)

    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText(/observed round 2/)).toBeInTheDocument()

    expect(screen.getByText('Private intel')).toBeInTheDocument()
    expect(screen.getByText(/Accepted: 62%/)).toBeInTheDocument()
    expect(screen.getByText(/expires at the end of Era 2/)).toBeInTheDocument()

    expect(screen.getAllByText('Public intel')).toHaveLength(2)
  })

  it('never invents an exact number for an unknown public band', () => {
    render(<KnowledgePanel view={READY_VIEW} {...NO_ERROR_PROPS} />)

    const bandsSection = screen.getByRole('list', { name: 'Public bands' })
    expect(bandsSection).not.toHaveTextContent(/\d+%/)
    expect(bandsSection).not.toHaveTextContent(/\b\d+\s*\/\s*\d+\b/)
  })

  it('shows placeholders instead of fabricating data for empty lists', () => {
    render(
      <KnowledgePanel
        view={{ kind: 'ready', gameId: 'game-1', eraNumber: 1, bands: [], revealedKnowledge: [], declarations: [], exposeFacts: [] }}
        {...NO_ERROR_PROPS}
      />,
    )

    expect(screen.getByText('No public bands have been published yet this era.')).toBeInTheDocument()
    expect(screen.getByText('You have not bought any intel this era.')).toBeInTheDocument()
    expect(screen.getByText('No Rally or Momentum declarations have been recorded this era.')).toBeInTheDocument()
    expect(screen.getByText('No Expose signatures have been revealed this era.')).toBeInTheDocument()
  })

  it('gives repeated observations of the same event across rounds distinct keys', () => {
    const view: Extract<KnowledgeView, { kind: 'ready' }> = {
      ...READY_VIEW,
      revealedKnowledge: [
        { kind: 'INFLUENCE', eventId: 'event-1', eventTitle: 'The Delegate Arrives', observedInRound: 1, expiresAtEraEnd: 2, influencerNames: ['Nora'] },
        { kind: 'INFLUENCE', eventId: 'event-1', eventTitle: 'The Delegate Arrives', observedInRound: 2, expiresAtEraEnd: 2, influencerNames: ['Eli'] },
      ],
    }
    render(<KnowledgePanel view={view} {...NO_ERROR_PROPS} />)

    expect(screen.getByText('Influenced by Nora')).toBeInTheDocument()
    expect(screen.getByText('Influenced by Eli')).toBeInTheDocument()
  })

  it('surfaces a stalled poll as a retryable alert instead of silently showing stale data', () => {
    const onRefresh = vi.fn()
    render(<KnowledgePanel view={READY_VIEW} error="Could not reach the game server." isRefreshing={false} onRefresh={onRefresh} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Could not reach the game server.')

    screen.getByRole('button', { name: 'Retry' }).click()
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})
