import type { PendingActionSummary } from '../types/playerView'

interface ActionConfirmationPanelProps {
  readonly pendingAction: PendingActionSummary | null
  readonly isSampleData: boolean
  readonly onConfirm?: () => void
}

export function ActionConfirmationPanel({ pendingAction, isSampleData, onConfirm }: ActionConfirmationPanelProps) {
  return (
    <section aria-labelledby="action-confirmation-heading">
      <h2 id="action-confirmation-heading">Action confirmation</h2>
      {pendingAction ? (
        <div>
          <p>
            {pendingAction.summary} → {pendingAction.targetLabel}
          </p>
          <button type="button" disabled={isSampleData || !onConfirm} onClick={onConfirm}>
            {pendingAction.confirmLabel}
          </button>
        </div>
      ) : (
        <p>No action pending confirmation.</p>
      )}
    </section>
  )
}
