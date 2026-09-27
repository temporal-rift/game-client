import type { RoundSummaryView } from '../round-summary/roundSummaryView'

interface RoundSummaryPanelProps {
  readonly view: RoundSummaryView
}

/**
 * Renders the most recently completed round's public summary: one entry per
 * participant with only the published typed category and family. Card
 * entries show category and family, faction specials show family with no
 * category, and skips show neither. Never renders a card type, grade,
 * special name, faction, or target.
 */
export function RoundSummaryPanel({ view }: RoundSummaryPanelProps) {
  if (view.kind === 'unavailable') {
    return (
      <section aria-label="Last round summary">
        <h2>Last round summary</h2>
        <p>{view.reason}</p>
      </section>
    )
  }

  return (
    <section aria-label="Last round summary">
      <h2>Last round summary</h2>
      <p>
        Era {view.eraNumber} · Round {view.roundNumber} · category and family only
      </p>
      {view.entries.length === 0 ? (
        <p>No summary entries were published for this round.</p>
      ) : (
        <ul aria-label="Round summary entries">
          {view.entries.map((entry) => (
            <li key={entry.playerId}>
              {entry.kind === 'card' && (
                <span>
                  <strong>{entry.playerName}</strong> · {entry.categoryLabel} · {entry.familyLabel}
                </span>
              )}
              {entry.kind === 'special' && (
                <span>
                  <strong>{entry.playerName}</strong> · Special
                </span>
              )}
              {entry.kind === 'skipped' && (
                <span>
                  <strong>{entry.playerName}</strong> · Skipped
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
