import type { BoardRoundStatus } from '../board/boardView'

function ownStateLabel(hasSubmitted: boolean | null): string | null {
  if (hasSubmitted === null) return null
  return hasSubmitted ? 'You have submitted' : 'You have not submitted'
}

/** Who has decided in the open window, never what anyone chose. */
export function RoundStatusPanel({ roundStatus }: { readonly roundStatus: BoardRoundStatus | null }) {
  const ownState = roundStatus ? ownStateLabel(roundStatus.hasSubmitted) : null
  return (
    <aside className="action-rail" aria-labelledby="round-status-heading">
      <section className="round-status-panel">
        <h2 id="round-status-heading" className="panel-eyebrow">
          Round status
        </h2>
        {roundStatus ? (
          <>
            <p className="submission-count">
              {roundStatus.submittedCount} / {roundStatus.totalPlayers} players submitted
            </p>
            {ownState && (
              <p className="submission-state">
                <span className="status-dot" aria-hidden="true" />
                {ownState}
              </p>
            )}
          </>
        ) : (
          <p className="submission-count">No decision window is open</p>
        )}
      </section>
    </aside>
  )
}
