import type { EventBoardEntry, EventOutcome, HandCard, RoundStatus } from '../types/playerView'
import { CardGlyph, GradeBadge } from './icons'

export interface SelectedTarget {
  readonly event: EventBoardEntry
  readonly outcome: EventOutcome
}

interface ActionConfirmationPanelProps {
  readonly selectedCard: HandCard | null
  readonly selectedTarget: SelectedTarget | null
  readonly confirmLabel: string
  readonly roundStatus: RoundStatus
  readonly isSampleData: boolean
  readonly onConfirm?: () => void
}

export function ActionConfirmationPanel({
  selectedCard,
  selectedTarget,
  confirmLabel,
  roundStatus,
  isSampleData,
  onConfirm,
}: ActionConfirmationPanelProps) {
  const hasCompleteSelection = Boolean(selectedCard && selectedTarget)

  return (
    <aside className="action-rail" aria-label="Action confirmation">
      <section className="action-summary-panel" aria-labelledby="action-confirmation-heading">
        <h2 id="action-confirmation-heading" className="panel-eyebrow">
          Your action
        </h2>
        {selectedCard && selectedTarget ? (
          <div className="action-summary" aria-live="polite" aria-atomic="true">
            <span className="action-glyph-well">
              <CardGlyph kind={selectedCard.kind} />
            </span>
            <p className="action-name">{selectedCard.name}</p>
            <p className="action-grade">
              <GradeBadge grade={selectedCard.grade} /> · {selectedCard.description}
            </p>
            <div className="action-target">
              <span>Target</span>
              <strong>{selectedTarget.event.title}</strong>
              <p>{selectedTarget.outcome.label}</p>
            </div>
            <p className="action-privacy">Exact live weights remain hidden. The server validates your action.</p>
          </div>
        ) : (
          <p className="action-empty">Choose an available card and a legal outcome.</p>
        )}
      </section>
      <section className="round-status-panel" aria-labelledby="round-status-heading">
        <h2 id="round-status-heading" className="panel-eyebrow">
          Round status
        </h2>
        <p className="submission-count">
          {roundStatus.submittedPlayers} / {roundStatus.totalPlayers} players submitted
        </p>
        <p className="submission-state">
          <span className="status-dot" aria-hidden="true" />
          {roundStatus.hasSubmitted ? 'Your action is submitted' : 'You have not submitted'}
        </p>
        <button
          type="button"
          className="confirm-button"
          disabled={!hasCompleteSelection || isSampleData || !onConfirm}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <p className="round-note">One action this round</p>
        <p className="round-note">Private until round closure</p>
      </section>
    </aside>
  )
}
