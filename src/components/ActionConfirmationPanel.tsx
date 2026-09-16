import type { PendingActionSummary } from '../types/playerView'

interface ActionConfirmationPanelProps {
  readonly pendingAction: PendingActionSummary | null
}

export function ActionConfirmationPanel({ pendingAction }: ActionConfirmationPanelProps) {
  return (
    <section aria-labelledby="action-confirmation-heading">
      <h2 id="action-confirmation-heading">Action confirmation</h2>
      {pendingAction ? (
        <div>
          <p>
            {pendingAction.summary} → {pendingAction.targetLabel}
          </p>
          <button type="button">{pendingAction.confirmLabel}</button>
        </div>
      ) : (
        <p>No action pending confirmation.</p>
      )}
    </section>
  )
}
