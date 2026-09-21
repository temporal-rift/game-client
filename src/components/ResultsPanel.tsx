import { endReasonLabel, type ResultsView } from '../results/resultsView'

interface ResultsPanelProps {
  readonly view: ResultsView
  readonly ownPlayerId: string | null
  readonly error: string | null
  readonly isRefreshing: boolean
  readonly onRefresh: () => void
}

function displayName(playerId: string, playerName: string | null, ownPlayerId: string | null): string {
  if (ownPlayerId !== null && playerId === ownPlayerId) {
    return playerName ? `${playerName} (you)` : 'You'
  }
  return playerName ?? `Player ${playerId.slice(0, 8)}`
}

function WinnerList({ view, ownPlayerId }: { readonly view: Extract<ResultsView, { kind: 'complete' }>; readonly ownPlayerId: string | null }) {
  if (view.winners.length === 0) {
    return <p>No winners were recorded for this ending.</p>
  }
  return (
    <ul aria-label="Winners">
      {view.winners.map((winner) => (
        <li key={winner.playerId}>
          <strong>{displayName(winner.playerId, winner.playerName, ownPlayerId)}</strong>
          {winner.faction ? <span> · {winner.faction}</span> : <span> · faction withheld</span>}
          <span> · {winner.score} points</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Renders authoritative terminal facts only: the published winner set,
 * ending cause and final scores. Winners are never derived from score
 * order or faction guesses. Before the recorded reveal boundary, factions
 * stay withheld and score-change reasons appear only where the viewer is
 * entitled to them; withheld reasons are labeled as such instead of being
 * guessed.
 */
export function ResultsPanel({ view, ownPlayerId, error, isRefreshing, onRefresh }: ResultsPanelProps) {
  if (view.kind === 'active') {
    return (
      <section aria-label="Final results">
        <h2>Final results</h2>
        <p>The game is still in progress. Final winners appear here once the game ends.</p>
        {error && (
          <p role="alert">
            {error} <button type="button" onClick={onRefresh} disabled={isRefreshing}>Retry</button>
          </p>
        )}
      </section>
    )
  }

  if (view.kind === 'waiting') {
    return (
      <section aria-label="Final results">
        <h2>Final results</h2>
        <p role="status">The game has ended. Final results are being prepared — refresh until the authoritative winners arrive.</p>
        <button type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? 'Refreshing…' : 'Refresh results'}
        </button>
        {error && <p role="alert">{error}</p>}
      </section>
    )
  }

  if (view.kind === 'unknown-terminal') {
    return (
      <section aria-label="Final results">
        <h2>Final results</h2>
        <p role="alert">The game ended with an unrecognized ending ({view.endReasonRaw}). Refresh for the authoritative result.</p>
        <button type="button" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? 'Refreshing…' : 'Refresh results'}
        </button>
        {error && <p role="alert">{error}</p>}
      </section>
    )
  }

  return (
    <section aria-label="Final results">
      <h2>Final results</h2>
      <p>
        <strong>{endReasonLabel(view.endReason)}</strong>
      </p>
      <h3>Winners</h3>
      <WinnerList view={view} ownPlayerId={ownPlayerId} />
      <h3>Final scores</h3>
      <ol aria-label="Final scores">
        {view.scores.map((entry) => (
          <li key={entry.playerId}>
            <span>{displayName(entry.playerId, entry.playerName, ownPlayerId)}</span>
            <span> · {entry.score} points</span>
            {entry.isWinner && <span> · winner</span>}
            {view.isRevealed ? (
              entry.faction ? (
                <span> · {entry.faction}</span>
              ) : (
                <span> · faction withheld</span>
              )
            ) : (
              <span> · faction hidden until the final reveal</span>
            )}
          </li>
        ))}
      </ol>
      {!view.isRevealed && <p>Factions remain hidden until the recorded reveal boundary permits the final reveal.</p>}
      <h3>Score explanations</h3>
      {view.explanations.length === 0 ? (
        <p>No score explanations were published for this game.</p>
      ) : (
        <ul aria-label="Score explanations">
          {view.explanations.map((explanation, index) => (
            <li key={`${explanation.eraNumber}-${explanation.playerId}-${index}`}>
              <span>
                Era {explanation.eraNumber} · {displayName(explanation.playerId, explanation.playerName, ownPlayerId)} ·{' '}
                {explanation.pointsDelta >= 0 ? `+${explanation.pointsDelta}` : explanation.pointsDelta} points
              </span>{' '}
              {explanation.reason ? (
                <span>· {explanation.reason}</span>
              ) : (
                <span>· reason withheld to protect hidden information</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onRefresh} disabled={isRefreshing}>
        {isRefreshing ? 'Refreshing…' : 'Refresh results'}
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
