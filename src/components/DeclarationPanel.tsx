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
        <output>You skipped this declaration window.</output>
        <p>{deadlineLabel(secondsRemaining)}</p>
      </section>
    )
  }

  const selectedMode = draft.kind === 'declaration' ? draft.mode : null
  const complete = Boolean(
    draft.kind === 'declaration' && draft.mode && draft.targetEventId && draft.targetOutcomeId,
  )
  const isSubmitting = submitPhase.kind === 'submitting' || submitPhase.kind === 'awaiting-projection'
  return (
    <section aria-label="Declaration window">
      <h2>Declaration window</h2>
      <p>Choose one declaration for an active event. {deadlineLabel(secondsRemaining)}</p>

      <h3>Your eligible declarations</h3>
      <ul aria-label="Eligible declaration modes">
        {view.eligibleModes.map((mode) => (
          <li key={mode}>
            <button
              type="button"
              aria-pressed={selectedMode === mode}
              disabled={isSubmitting}
              onClick={() => onSelectMode(mode)}
            >
              {specialDisplayName(mode)}
            </button>
            <span> — {DECLARATION_MODE_DESCRIPTIONS[mode]}</span>
          </li>
        ))}
      </ul>

      {selectedMode && (
        <>
          <h3>Declaration target</h3>
          {view.activeEvents.length === 0 ? (
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
        <h3>Confirm declaration</h3>
        <button type="button" disabled={!complete || isSubmitting} onClick={onConfirm}>
          {isSubmitting ? 'Submitting…' : 'Confirm declaration'}
        </button>
        <button type="button" disabled={isSubmitting} onClick={onSkip}>
          Skip this window
        </button>
        {draft.kind !== 'none' && (
          <button type="button" disabled={isSubmitting} onClick={onClearDraft}>
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
      </section>
    </section>
  )
}
