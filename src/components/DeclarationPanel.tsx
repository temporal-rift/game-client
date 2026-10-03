import { specialDisplayName } from '../action/actionRules'
import { DECLARATION_MODE_DESCRIPTIONS } from '../declaration/declarationView'
import type { DeclarationDraft, DeclarationSubmitPhase } from '../declaration/useDeclaration'
import type { DeclarationView } from '../declaration/declarationView'
import { formatCountdown, useDeadlineCountdown } from '../game/useDeadlineCountdown'

interface DeclarationPanelProps {
  readonly view: DeclarationView
  readonly draft: DeclarationDraft
  readonly submitPhase: DeclarationSubmitPhase
  readonly onSelectMode: (mode: 'RALLY' | 'MOMENTUM') => void
  readonly onSelectTarget: (targetEventId: string, targetOutcomeId: string) => void
  readonly onClearDraft: () => void
  readonly onSkip: () => void
  readonly onConfirm: () => void
  readonly onDismissRejection: () => void
}

function deadlineLabel(seconds: number | null): string {
  if (seconds === null) return 'Declaration deadline is being refreshed.'
  return `${formatCountdown(seconds)} remaining in the declaration window`
}

export function DeclarationPanel({
  view,
  draft,
  submitPhase,
  onSelectMode,
  onSelectTarget,
  onClearDraft,
  onSkip,
  onConfirm,
  onDismissRejection,
}: DeclarationPanelProps) {
  const deadline = view.kind === 'open' || view.kind === 'submitted' ? view.deadline : null
  const secondsRemaining = useDeadlineCountdown(deadline)
  if (view.kind === 'unavailable') return null
  if (view.kind === 'submitted') {
    return (
      <section aria-label="Declaration window">
        <h2>Declaration window</h2>
        <output>Your declaration was accepted.</output>
        <p>{deadlineLabel(secondsRemaining)}</p>
      </section>
    )
  }
  if (submitPhase.kind === 'skipped') {
    return (
      <section aria-label="Declaration window">
        <h2>Declaration window</h2>
        <output>You declined this declaration. Your ordinary Round 1 action is still available.</output>
        <p>{deadlineLabel(secondsRemaining)}</p>
      </section>
    )
  }

  const selectedMode = draft.kind === 'declaration' ? draft.mode : null
  const isSubmitting = submitPhase.kind === 'submitting' || submitPhase.kind === 'awaiting-projection' || submitPhase.kind === 'declining'
  const choiceLocked = isSubmitting || submitPhase.kind === 'decline-unknown'
  const selectedEvent = draft.kind === 'declaration' ? view.activeEvents.find((event) => event.eventId === draft.targetEventId) : undefined
  const selectedOutcome = draft.kind === 'declaration' ? selectedEvent?.outcomes.find((outcome) => outcome.outcomeId === draft.targetOutcomeId) : undefined
  const complete = Boolean(selectedMode && selectedEvent && selectedOutcome && view.eligibleModes.includes(selectedMode))
  return (
    <section aria-label="Declaration window">
      <h2>Declaration window</h2>
      <p>Declaring is optional and public. Back one outcome you want to win this era. Confirming uses your Round 1 action, so you will not play a card or another special in Round 1.</p>
      <p>Your exact outcome must win for the declaration to score. A stalled or cascaded event cannot make it succeed this era.</p>
      <p>{deadlineLabel(secondsRemaining)}</p>

      <div className="declaration-steps">
        <section>
          <h3>1. Choose how to back the outcome</h3>
          <ul aria-label="Eligible declaration modes">
            {view.eligibleModes.map((mode) => (
              <li key={mode}>
                <button
                  type="button"
                  aria-pressed={selectedMode === mode}
                  disabled={choiceLocked}
                  onClick={() => onSelectMode(mode)}
                >
                  {specialDisplayName(mode)}
                </button>
                <span> — {DECLARATION_MODE_DESCRIPTIONS[mode]}</span>
              </li>
            ))}
          </ul>

        </section>
        <section>
            <h3>2. Choose an event and its outcome</h3>
            {!selectedMode ? (
              <p>Choose a mode in step 1 to see the available outcomes.</p>
            ) : view.activeEvents.length === 0 ? (
              <output>Declaration targets are still being refreshed. Do not submit until an active event is shown.</output>
            ) : (
              <ul aria-label="Declaration targets">
                {view.activeEvents.map((event) => (
                  <li key={event.eventId}>
                    <strong>{event.title}</strong>
                    <ul aria-label={`${event.title} outcomes`}>
                      {event.outcomes.map((outcome) => (
                        <li key={outcome.outcomeId}>
                          <button
                            type="button"
                            aria-pressed={
                              draft.kind === 'declaration' && draft.targetOutcomeId === outcome.outcomeId
                            }
                            disabled={choiceLocked}
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
        </section>

        <section aria-live="polite" aria-atomic="true">
          <h3>3. Review and confirm</h3>
          {complete && selectedEvent && selectedOutcome && selectedMode && <p className="declaration-review">{specialDisplayName(selectedMode)} · {selectedEvent.title} → {selectedOutcome.description}. This uses your Round 1 action.</p>}
          <button type="button" disabled={!complete || choiceLocked} onClick={onConfirm}>
            {isSubmitting ? 'Submitting…' : 'Confirm declaration'}
          </button>
          <button type="button" disabled={isSubmitting} onClick={onSkip}>
            {submitPhase.kind === 'decline-unknown' ? 'Retry decline' : submitPhase.kind === 'declining' ? 'Declining…' : 'Decline declaration'}
          </button>
          <p>Declining keeps your ordinary Round 1 action available. The phase can finish once its declaration decisions are complete.</p>
          {draft.kind !== 'none' && (
            <button type="button" disabled={choiceLocked} onClick={onClearDraft}>
              Clear selection
            </button>
          )}
          {submitPhase.kind === 'rejected' && (
            <p role="alert">
              {submitPhase.message} Your selection is preserved while the window stays open.{' '}
              <button type="button" onClick={onDismissRejection}>
                Dismiss
              </button>
            </p>
          )}
          {submitPhase.kind === 'awaiting-projection' && <output>Waiting for game state to reflect your declaration.</output>}
          {submitPhase.kind === 'decline-unknown' && <p role="alert">{submitPhase.message}</p>}
        </section>
      </div>
    </section>
  )
}
