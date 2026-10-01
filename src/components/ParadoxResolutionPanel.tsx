import type { ParadoxDraft, ParadoxSubmitPhase } from '../paradox/useParadoxResolution'
import type { ParadoxResolutionView } from '../paradox/paradoxView'
import { CardIllustration } from '../illustrations/catalog'
import type { IllustrationSkin } from '../illustrations/catalogData'
import { formatCountdown, useDeadlineCountdown } from '../game/useDeadlineCountdown'

interface ParadoxResolutionPanelProps {
  readonly view: ParadoxResolutionView
  readonly draft: ParadoxDraft
  readonly submitPhase: ParadoxSubmitPhase
  readonly onSelectCard: (cardInstanceId: string) => void
  readonly onSelectTarget: (eventId: string, outcomeId: string) => void
  readonly onClearDraft: () => void
  readonly onConfirm: () => void
  readonly onDismissRejection: () => void
  readonly illustrationSkin?: IllustrationSkin
}

function deadlineLabel(seconds: number | null): string {
  if (seconds === null) return 'Deadline is being refreshed.'
  return `${formatCountdown(seconds)} remaining`
}

function progressLabel(submittedCount: number | null, totalPlayers: number | null): string {
  if (submittedCount === null || totalPlayers === null) return 'Phase progress is being refreshed.'
  return `${submittedCount} / ${totalPlayers} participants have responded.`
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
  illustrationSkin = 'board',
}: ParadoxResolutionPanelProps) {
  const secondsRemaining = useDeadlineCountdown(view.kind === 'open' || view.kind === 'submitted' ? view.deadline : null)
  if (view.kind === 'unavailable') return null
  if (view.kind === 'submitted') {
    return (
      <section aria-label="Paradox resolution">
        <h2>Paradox resolution</h2>
        <output>Your resolution choice was accepted.</output>
        <p>{progressLabel(view.submittedCount, view.totalPlayers)}</p>
        <p>{deadlineLabel(secondsRemaining)}</p>
      </section>
    )
  }

  const selectedCard = draft.kind === 'card' ? view.cards.find((card) => card.cardInstanceId === draft.cardInstanceId) : null
  const complete = Boolean(selectedCard && draft.kind === 'card' && draft.targetEventId && draft.targetOutcomeId)
  const isSubmitting = submitPhase.kind === 'submitting' || submitPhase.kind === 'awaiting-projection'
  return (
    <section aria-label="Paradox resolution">
      <h2>Paradox resolution</h2>
      <p>
        Choose one eligible card for an affected event. {deadlineLabel(secondsRemaining)}
      </p>
      <p>{progressLabel(view.submittedCount, view.totalPlayers)}</p>

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
                <CardIllustration cardType={card.cardType} skin={illustrationSkin} />
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
        {submitPhase.kind === 'awaiting-projection' && <output>Waiting for game state to reflect your choice.</output>}
      </section>
    </section>
  )
}
