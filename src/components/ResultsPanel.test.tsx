import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResultsPanel } from './ResultsPanel'
import type { ResultsView } from '../results/resultsView'

const complete: Extract<ResultsView, { kind: 'complete' }> = {
  kind: 'complete',
  gameId: 'game-1',
  endReason: 'WIN_CONDITION_MET',
  winners: [
    { playerId: 'p-1', playerName: 'Nora', score: 20, isWinner: true, faction: 'PROPHETS', winType: 'SCORE_THRESHOLD' },
    { playerId: 'p-2', playerName: 'Eli', score: 14, isWinner: true, faction: 'ERASERS', winType: 'FACTION_OBJECTIVE' },
  ],
  scores: [
    { playerId: 'p-1', playerName: 'Nora', score: 20, isWinner: true, faction: 'PROPHETS', winType: 'SCORE_THRESHOLD' },
    { playerId: 'p-2', playerName: 'Eli', score: 14, isWinner: true, faction: 'ERASERS', winType: 'FACTION_OBJECTIVE' },
    { playerId: 'p-3', playerName: 'You', score: 12, isWinner: false, faction: 'WEAVERS', winType: null },
  ],
  isRevealed: true,
  explanations: [
    { playerId: 'p-3', playerName: 'You', eraNumber: 1, pointsDelta: 4, reason: 'EVENT_RESOLVED_AS_WRITTEN', isOwn: true },
    { playerId: 'p-1', playerName: 'Nora', eraNumber: 1, pointsDelta: 2, reason: null, isOwn: false },
  ],
}

describe('ResultsPanel', () => {
  it('renders no final-results placeholder while the game is active', () => {
    const { container } = render(<ResultsPanel view={{ kind: 'active' }} ownPlayerId={null} error={null} isRefreshing={false} onRefresh={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps the accessible refresh name stable and disables repeat refreshes', () => {
    render(<ResultsPanel view={{ kind: 'waiting', gameId: 'game-1', eraNumber: 3 }} ownPlayerId={null} error={null} isRefreshing={true} onRefresh={() => {}} />)
    expect(screen.getByRole('button', { name: 'Refresh results' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Refresh results' })).toHaveTextContent('Refreshing…')
  })

  it('retains complete terminal facts when an enrichment refresh fails', () => {
    render(<ResultsPanel view={complete} ownPlayerId="p-3" error="Could not reach the server." isRefreshing={false} onRefresh={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the server.')
    expect(screen.getByRole('list', { name: 'Winners' })).toHaveTextContent('Nora')
    expect(screen.getByRole('list', { name: 'Final scores' })).toHaveTextContent('12 points')
  })

  it('displays every shared normal winner, the ending cause and final scores', () => {
    render(<ResultsPanel view={complete} ownPlayerId="p-3" error={null} isRefreshing={false} onRefresh={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Final results' })).toBeInTheDocument()
    expect(screen.getByText('Victory')).toBeInTheDocument()
    const winners = screen.getByRole('list', { name: 'Winners' })
    expect(winners.textContent).toContain('Nora')
    expect(winners.textContent).toContain('reached the score threshold')
    expect(winners.textContent).toContain('Eli')
    expect(winners.textContent).toContain('completed their faction objective')
    expect(screen.getByRole('list', { name: 'Final scores' }).textContent).toContain('12 points')
  })

  it('uses the published special winner set rather than score order', () => {
    const collapsed: ResultsView = {
      ...complete,
      endReason: 'TIMELINE_COLLAPSED',
      winners: [{ playerId: 'p-3', playerName: 'You', score: 6, isWinner: true, faction: 'ACTIVISTS', winType: null }],
    }
    render(<ResultsPanel view={collapsed} ownPlayerId="p-3" error={null} isRefreshing={false} onRefresh={() => {}} />)

    expect(screen.getByText('Timeline collapsed')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Winners' }).textContent).toContain('You')
  })

  it('shows readiness until authoritative complete results arrive', async () => {
    const onRefresh = vi.fn()
    render(
      <ResultsPanel
        view={{ kind: 'waiting', gameId: 'game-1', eraNumber: 3 }}
        ownPlayerId="p-3"
        error={null}
        isRefreshing={false}
        onRefresh={onRefresh}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/being prepared/i)
    expect(screen.queryByRole('list', { name: 'Winners' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /refresh results/i }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('respects explanation and reveal boundaries instead of guessing', () => {
    const unrevealed: ResultsView = {
      ...complete,
      isRevealed: false,
      winners: complete.winners.map((winner) => ({ ...winner, faction: null })),
      scores: complete.scores.map((score) => ({ ...score, faction: null })),
    }
    render(<ResultsPanel view={unrevealed} ownPlayerId="p-3" error={null} isRefreshing={false} onRefresh={() => {}} />)

    expect(screen.getByText(/hidden until the recorded reveal/i)).toBeInTheDocument()
    expect(screen.getByText(/withheld to protect hidden information/i)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('PROPHETS')
  })

  it('surfaces refresh errors without inventing results', () => {
    render(
      <ResultsPanel
        view={{ kind: 'waiting', gameId: 'game-1', eraNumber: 3 }}
        ownPlayerId="p-3"
        error="Could not reach the game server."
        isRefreshing={false}
        onRefresh={() => {}}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/could not reach/i)
    expect(screen.queryByRole('list', { name: 'Winners' })).not.toBeInTheDocument()
  })

  it('explains a last-player-standing win', () => {
    const view: Extract<ResultsView, { kind: 'complete' }> = {
      ...complete,
      winners: [{ playerId: 'p-3', playerName: 'You', score: 7, isWinner: true, faction: 'WEAVERS', winType: 'LAST_PLAYER_STANDING' }],
    }
    render(<ResultsPanel view={view} ownPlayerId="p-3" error={null} isRefreshing={false} onRefresh={() => {}} />)

    expect(screen.getByRole('list', { name: 'Winners' }).textContent).toContain('last player standing — everyone else left')
  })

  it('uses player-facing text for the Mimic concealment score reason', () => {
    const view: Extract<ResultsView, { kind: 'complete' }> = {
      ...complete,
      explanations: [{ playerId: 'p-1', playerName: 'Nora', eraNumber: 3, pointsDelta: 6, reason: 'MIMIC_NEVER_TRACED', isOwn: false }],
    }
    render(<ResultsPanel view={view} ownPlayerId="p-3" error={null} isRefreshing={false} onRefresh={() => {}} />)

    expect(screen.getByText(/Mimic was never traced/)).toBeInTheDocument()
    expect(screen.queryByText('MIMIC_NEVER_TRACED')).not.toBeInTheDocument()
  })
})
