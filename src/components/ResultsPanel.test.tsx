import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResultsPanel } from './ResultsPanel'
import type { ResultsView } from '../results/resultsView'

const complete: Extract<ResultsView, { kind: 'complete' }> = {
  kind: 'complete',
  gameId: 'game-1',
  endReason: 'SCORE_THRESHOLD',
  endReasonRaw: 'SCORE_THRESHOLD',
  winners: [
    { playerId: 'p-1', playerName: 'Nora', score: 20, isWinner: true, faction: 'PROPHETS' },
    { playerId: 'p-2', playerName: 'Eli', score: 20, isWinner: true, faction: 'ERASERS' },
  ],
  scores: [
    { playerId: 'p-1', playerName: 'Nora', score: 20, isWinner: true, faction: 'PROPHETS' },
    { playerId: 'p-2', playerName: 'Eli', score: 20, isWinner: true, faction: 'ERASERS' },
    { playerId: 'p-3', playerName: 'You', score: 12, isWinner: false, faction: 'WEAVERS' },
  ],
  isRevealed: true,
  explanations: [
    { playerId: 'p-3', playerName: 'You', eraNumber: 1, pointsDelta: 4, reason: 'EVENT_RESOLVED_AS_WRITTEN', isOwn: true },
    { playerId: 'p-1', playerName: 'Nora', eraNumber: 1, pointsDelta: 2, reason: null, isOwn: false },
  ],
}

describe('ResultsPanel', () => {
  it('displays every shared normal winner, the ending cause and final scores', () => {
    render(<ResultsPanel view={complete} ownPlayerId="p-3" error={null} isRefreshing={false} onRefresh={() => {}} />)

    expect(screen.getByRole('heading', { name: 'Final results' })).toBeInTheDocument()
    expect(screen.getByText('Score threshold reached')).toBeInTheDocument()
    const winners = screen.getByRole('list', { name: 'Winners' })
    expect(winners.textContent).toContain('Nora')
    expect(winners.textContent).toContain('Eli')
    expect(screen.getByRole('list', { name: 'Final scores' }).textContent).toContain('12 points')
  })

  it('uses the published special winner set rather than score order', () => {
    const collapsed: ResultsView = {
      ...complete,
      endReason: 'TIMELINE_COLLAPSED',
      endReasonRaw: 'TIMELINE_COLLAPSED',
      winners: [{ playerId: 'p-3', playerName: 'You', score: 6, isWinner: true, faction: 'ACTIVISTS' }],
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
})
