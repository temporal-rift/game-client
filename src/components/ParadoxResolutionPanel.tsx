import type { ParadoxDraft, ParadoxSubmitPhase } from '../paradox/useParadoxResolution'
import type { ParadoxResolutionView } from '../paradox/paradoxView'

interface ParadoxResolutionPanelProps {
  readonly view: ParadoxResolutionView
  readonly draft: ParadoxDraft
  readonly submitPhase: ParadoxSubmitPhase
  readonly onSelectCard: (cardInstanceId: string) => void
  readonly onSelectTarget: (eventId: string, outcomeId: string) => void
  readonly onClearDraft: () => void
  readonly onConfirm: () => void
  readonly onDismissRejection: () => void
}

function deadlineLabel(seconds: number | null): string {
  if (seconds === null) return 'Deadline is being refreshed.'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')} remaining`
}

export function ParadoxResolutionPanel({
  view,
  draft,
  submitPhase,
  onSelectCard,
  onSelectTarget,
  onClearDraft,
  onConfirm,
  onDismissRejection,
}: ParadoxResolutionPanelProps) {
  if (view.kind === 'unavailable') return null
  if (view.kind === 'loading') return <output>Loading paradox-resolution choices…</output>
  if (view.kind === 'closed') return <output>{view.reason}</output>
  if (view.kind === 'submitted') {
    return (
      <section aria-label="Paradox resolution">
        <h2>Paradox resolution</h2>
        <output>Your resolution choice was accepted.</output>
        <p>
          {view.submittedCount} / {view.totalPlayers} participants have responded. Waiting for the authoritative phase result.
        </p>
      </section>
    )
  }

  const selectedCard = draft.kind === 'card' ? view.cards.find((card) => card.cardInstanceId === draft.cardInstanceId) : null
  const complete = Boolean(selectedCard && draft.kind === 'card' && draft.targetEventId && draft.targetOutcomeId)
  const isSubmitting = submitPhase.kind === 'submitting'
  return (
    <section aria-label="Paradox resolution">
      <h2>Paradox resolution</h2>
      <p>
        Choose one eligible card for an affected event. {deadlineLabel(view.timerRemainingSeconds)}
      </p>
      <p>
        {view.submittedCount} / {view.totalPlayers} participants have responded.
      </p>

      <h3>Your eligible choices</h3>
      {view.cards.length === 0 ? (
        <output>No eligible resolution cards are currently available.</output>
      ) : (
        <ul aria-label="Eligible resolution cards">
          {view.cards.map((card) => (
            <li key={card.cardInstanceId}>
              <button
                type="button"
                aria-pressed={selectedCard?.cardInstanceId === card.cardInstanceId}
                disabled={isSubmitting}
                onClick={() => onSelectCard(card.cardInstanceId)}
              >
                {card.name} · Grade {card.grade}
              </button>
              <span> — {card.effectSummary}</span>
            </li>
          ))}
        </ul>
      )}

      {selectedCard && (
        <>
          <h3>Affected events</h3>
          {view.affectedEvents.length === 0 ? (
            <output>Resolution targets are still being refreshed. Do not submit until an affected event is shown.</output>
          ) : (
            <ul aria-label="Affected events">
              {view.affectedEvents.map((event) => (
                <li key={event.eventId}>
                  <strong>{event.title}</strong>
                  <ul aria-label={`${event.title} outcomes`}>
                    {event.outcomes.map((outcome) => (
                      <li key={outcome.outcomeId}>
                        <button
                          type="button"
                          aria-pressed={draft.kind === 'card' && draft.targetOutcomeId === outcome.outcomeId}
                          disabled={isSubmitting}
                          onClick={() => onSelectTarget(event.eventId, outcome.outcomeId)}
                        >
                          {outcome.description}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <section aria-live="polite" aria-atomic="true">
        <h3>Confirm resolution choice</h3>
        <button type="button" disabled={!complete || isSubmitting} onClick={onConfirm}>
          {isSubmitting ? 'Submitting…' : 'Confirm resolution choice'}
        </button>
        {selectedCard && (
          <button type="button" disabled={isSubmitting} onClick={onClearDraft}>
            Clear selection
          </button>
        )}
        {submitPhase.kind === 'rejected' && (
          <p role="alert">
            {submitPhase.message} Your selection is preserved.{' '}
            <button type="button" onClick={onDismissRejection}>
              Dismiss
            </button>
          </p>
        )}
        {submitPhase.kind === 'submitted' && <output>Resolution choice submitted.</output>}
      </section>
    </section>
  )
}
