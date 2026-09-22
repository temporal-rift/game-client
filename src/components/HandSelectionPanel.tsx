import type { HandSelectionSubmitPhase } from '../hand/useHandSelection'
import type { HandSelectionView } from '../hand/handSelectionView'

function deadlineLabel(expiresAt: string): string {
  const timestamp = Date.parse(expiresAt)
  return Number.isNaN(timestamp) ? 'Server deadline is active.' : `Server deadline: ${new Date(timestamp).toLocaleTimeString()}.`
}

export function HandSelectionPanel({
  view,
  selectedCardInstanceIds,
  submitPhase,
  onToggleCard,
  onConfirm,
  onDismissRejection,
}: {
  readonly view: HandSelectionView
  readonly selectedCardInstanceIds: readonly string[]
  readonly submitPhase: HandSelectionSubmitPhase
  readonly onToggleCard: (cardInstanceId: string) => void
  readonly onConfirm: () => void
  readonly onDismissRejection: () => void
}) {
  if (view.kind === 'unavailable') {
    return (
      <section aria-label="Hand selection">
        <h2>Your hand selection</h2>
        <p>{view.reason}</p>
      </section>
    )
  }
  if (view.kind === 'accepted') {
    return (
      <section aria-label="Hand selection">
        <h2>Your accepted hand</h2>
        <p>Your server-accepted five-card hand is ready.</p>
        <ul aria-label="Accepted hand">
          {view.cards.map((card) => (
            <li key={card.cardInstanceId}>
              {card.name} · Grade {card.grade} — {card.effectSummary}
            </li>
          ))}
        </ul>
      </section>
    )
  }

  const selected = new Set(selectedCardInstanceIds)
  const canConfirm = selected.size === view.requiredSelectionCount && submitPhase.kind !== 'submitting'
  return (
    <section aria-label="Hand selection">
      <h2>Choose your hand</h2>
      <p>
        Keep exactly {view.requiredSelectionCount} of your seven private cards. {selected.size} / {view.requiredSelectionCount} selected.
      </p>
      <p>{deadlineLabel(view.expiresAt)} The server decides expiry and any timeout selection.</p>
      {submitPhase.kind === 'rejected' && (
        <div role="alert">
          <p>{submitPhase.message}</p>
          <button type="button" onClick={onDismissRejection}>Dismiss</button>
        </div>
      )}
      <ul aria-label="Private card offer">
        {view.cards.map((card) => {
          const isSelected = selected.has(card.cardInstanceId)
          return (
            <li key={card.cardInstanceId}>
              <button
                type="button"
                aria-pressed={isSelected}
                disabled={submitPhase.kind === 'submitting' || (!isSelected && selected.size === view.requiredSelectionCount)}
                onClick={() => onToggleCard(card.cardInstanceId)}
              >
                {isSelected ? 'Keeping' : 'Offer'} · {card.name} · Grade {card.grade} — {card.effectSummary}
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" disabled={!canConfirm} onClick={onConfirm}>
        {submitPhase.kind === 'submitting' ? 'Confirming hand…' : 'Confirm five cards'}
      </button>
    </section>
  )
}
