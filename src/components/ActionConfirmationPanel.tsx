import type { EventBoardEntry, HandCard } from '../types/playerView'
import { ConnectionGlyph } from './icons'

interface ActionConfirmationPanelProps {
  readonly selectedCard: HandCard | null
  readonly selectedTarget: EventBoardEntry | null
  readonly confirmLabel: string
  readonly isSampleData: boolean
  readonly onConfirm?: () => void
}

export function ActionConfirmationPanel({
  selectedCard,
  selectedTarget,
  confirmLabel,
  isSampleData,
  onConfirm,
}: ActionConfirmationPanelProps) {
  return (
    <section aria-labelledby="action-confirmation-heading">
      <h2 id="action-confirmation-heading">Action confirmation</h2>
      {selectedCard && selectedTarget ? (
        <div>
          <ConnectionGlyph />
          <p aria-live="polite" aria-atomic="true">
            {selectedCard.name} (grade {selectedCard.grade}) → {selectedTarget.title}
          </p>
          <button type="button" className="confirm-button" disabled={isSampleData || !onConfirm} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      ) : (
        <p>Select a card and a target to confirm an action.</p>
      )}
    </section>
  )
}
