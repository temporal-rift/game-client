import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoundSummaryView } from '../round-summary/roundSummaryView'
import { BoardRoundSummary } from './BoardRoundSummary'

const summary: Extract<RoundSummaryView, { kind: 'ready' }> = {
  kind: 'ready', gameId: 'game-1', eraNumber: 2, roundNumber: 1,
  entries: [{ kind: 'special', playerId: 'p-1', playerName: 'Ana' }, { kind: 'skipped', playerId: 'p-2', playerName: 'Bo' }],
}

describe('BoardRoundSummary', () => {
  afterEach(() => vi.useRealTimers())

  it('renders nothing before a round has closed', () => {
    const { container } = render(<BoardRoundSummary view={{ kind: 'unavailable', reason: 'No round has closed yet.' }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('briefly presents the public summary then keeps it available to reopen', () => {
    vi.useFakeTimers()
    render(<BoardRoundSummary view={summary} />)
    const toggle = screen.getByRole('button', { name: 'Last round summary' })
    expect(screen.getByRole('status')).toHaveTextContent('Era 2 · Round 1 closed')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: 'Last round summary' })).toHaveTextContent('Ana · Special')
    act(() => vi.advanceTimersByTime(6_000))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Last round summary' })).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.getByRole('region', { name: 'Last round summary' })).toHaveTextContent('Bo · Skipped')
    act(() => vi.advanceTimersByTime(60_000))
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('does not restart the presentation when polling repeats the same round', () => {
    vi.useFakeTimers()
    const { rerender } = render(<BoardRoundSummary view={summary} />)
    act(() => vi.advanceTimersByTime(4_000))
    rerender(<BoardRoundSummary view={{ ...summary, entries: [...summary.entries] }} />)
    act(() => vi.advanceTimersByTime(2_000))
    expect(screen.getByRole('button', { name: 'Last round summary' })).toHaveAttribute('aria-expanded', 'false')
    rerender(<BoardRoundSummary view={{ ...summary }} />)
    expect(screen.getByRole('button', { name: 'Last round summary' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('can keep the brief presentation open for reading', () => {
    vi.useFakeTimers()
    render(<BoardRoundSummary view={summary} />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep summary open' }))
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('region', { name: 'Last round summary' })).toBeVisible()
  })

  it('keeps a brief summary open when a keyboard user focuses its controls', () => {
    vi.useFakeTimers()
    render(<BoardRoundSummary view={summary} />)
    const keep = screen.getByRole('button', { name: 'Keep summary open' })
    fireEvent.focus(keep)
    act(() => vi.advanceTimersByTime(6_000))
    expect(screen.getByRole('region', { name: 'Last round summary' })).toBeVisible()
    expect(keep).toBeInTheDocument()
  })

  it('replaces the previous round and starts a new brief presentation', () => {
    vi.useFakeTimers()
    const { rerender } = render(<BoardRoundSummary view={summary} />)
    act(() => vi.advanceTimersByTime(6_000))
    rerender(<BoardRoundSummary view={{ ...summary, roundNumber: 2, entries: [{ kind: 'skipped', playerId: 'p-3', playerName: 'Cy' }] }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 closed')
    const entries = screen.getByRole('region', { name: 'Last round summary' })
    expect(within(entries).getByText('Cy')).toBeInTheDocument()
    expect(within(entries).queryByText('Ana')).not.toBeInTheDocument()
  })

  it('restores the same latest summary on reload and clears the old timer', () => {
    vi.useFakeTimers()
    const first = render(<BoardRoundSummary view={summary} />)
    act(() => vi.advanceTimersByTime(3_000))
    first.unmount()
    expect(vi.getTimerCount()).toBe(0)
    render(<BoardRoundSummary view={summary} />)
    act(() => vi.advanceTimersByTime(3_000))
    expect(screen.getByRole('region', { name: 'Last round summary' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Era 2 · Round 1 closed')
  })

  it('starts fresh when the game or era changes even with the same round number', () => {
    vi.useFakeTimers()
    const { rerender } = render(<BoardRoundSummary view={summary} />)
    act(() => vi.advanceTimersByTime(6_000))
    rerender(<BoardRoundSummary view={{ ...summary, gameId: 'other-game' }} />)
    expect(screen.getByRole('region', { name: 'Last round summary' })).toBeVisible()
    act(() => vi.advanceTimersByTime(6_000))
    rerender(<BoardRoundSummary view={{ ...summary, gameId: 'other-game', eraNumber: 3 }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Era 3')
    expect(screen.getByRole('region', { name: 'Last round summary' })).toBeVisible()
  })
})
