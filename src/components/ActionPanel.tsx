import type { ActionCoordinates, SpecialAction } from '../api/actionClient'
import type { ActionDraft, SubmitPhase } from '../action/useActionSubmission'
import type { ActionRoundView, HandCardOption, SpecialActionOption } from '../action/actionView'
import { scanEventCountForGrade } from '../action/actionRules'

interface ActionPanelProps {
  readonly view: ActionRoundView
  readonly draft: ActionDraft
  readonly submitPhase: SubmitPhase
  readonly onSelectCard: (cardInstanceId: string, coordinates: ActionCoordinates) => void
  readonly onSelectSpecial: (specialAction: SpecialAction, coordinates: ActionCoordinates) => void
  readonly onClearDraft: () => void
  readonly onConfirm: () => void
  readonly onDismissRejection: () => void
}

type Selected = { readonly kind: 'card'; readonly card: HandCardOption } | { readonly kind: 'special'; readonly special: SpecialActionOption } | null

function coordinatesComplete(mode: string, coordinates: ActionCoordinates, requiredEventCount: number): boolean {
  switch (mode) {
    case 'EVENT_OUTCOME':
      return Boolean(coordinates.targetEventId && coordinates.targetOutcomeId)
    case 'EVENT_OUTCOME_PAIR':
      return Boolean(
        coordinates.targetEventId &&
          coordinates.sourceOutcomeId &&
          coordinates.targetOutcomeId &&
          coordinates.sourceOutcomeId !== coordinates.targetOutcomeId,
      )
    case 'EVENT_LIST':
      return (coordinates.targetEventIds?.length ?? 0) === requiredEventCount
    case 'PLAYER':
      return Boolean(coordinates.targetPlayerId)
    case 'EVENT_ONLY':
      return Boolean(coordinates.targetEventId)
    case 'NONE':
      return true
    default:
      return false
  }
}

/**
 * Renders the authoritative action-round options for one participant: legal
 * graded cards and faction specials (with server-supplied availability and
 * budgets), precise target selection matching each card/special's
 * coordinate shape, and confirmation. Never fabricates availability or
 * targeting — every option shown comes from the server-supplied state.
 */
export function ActionPanel({
  view,
  draft,
  submitPhase,
  onSelectCard,
  onSelectSpecial,
  onClearDraft,
  onConfirm,
  onDismissRejection,
}: ActionPanelProps) {
  if (view.kind === 'unavailable') {
    return (
      <section aria-label="Your action">
        <h2>Your action</h2>
        <p>{view.reason}</p>
      </section>
    )
  }

  if (view.hasSubmitted) {
    return (
      <section aria-label="Your action">
        <h2>Your action</h2>
        <p role="status">Your action is submitted for this round. Private until round closure.</p>
      </section>
    )
  }

  const selected: Selected =
    draft.kind === 'card'
      ? (() => {
          const card = view.hand.find((entry) => entry.cardInstanceId === draft.cardInstanceId) ?? null
          return card ? { kind: 'card', card } : null
        })()
      : draft.kind === 'special'
        ? (() => {
            const special = view.specials.find((entry) => entry.specialAction === draft.specialAction) ?? null
            return special ? { kind: 'special', special } : null
          })()
        : null

  const targetMode = selected?.kind === 'card' ? selected.card.targetMode : selected?.kind === 'special' ? selected.special.targetMode : null
  const requiredEventCount = selected?.kind === 'card' && selected.card.targetMode === 'EVENT_LIST' ? scanEventCountForGrade(selected.card.grade) : 0
  const coordinates: ActionCoordinates = draft.kind === 'none' ? {} : draft.coordinates

  function applyCoordinates(next: ActionCoordinates): void {
    if (draft.kind === 'card') {
      onSelectCard(draft.cardInstanceId, next)
    } else if (draft.kind === 'special') {
      onSelectSpecial(draft.specialAction, next)
    }
  }

  function toggleListEvent(eventId: string): void {
    const current = coordinates.targetEventIds ?? []
    const next = current.includes(eventId)
      ? current.filter((id) => id !== eventId)
      : current.length < requiredEventCount
        ? [...current, eventId]
        : current
    applyCoordinates({ targetEventIds: next })
  }

  const isComplete = selected !== null && targetMode !== null && coordinatesComplete(targetMode, coordinates, requiredEventCount)

  return (
    <section aria-label="Your action">
      <h2>Your action</h2>
      <p>
        Era {view.eraNumber} · Round {view.roundNumber} · one card or one special this round
      </p>

      <h3>Your hand</h3>
      <ul aria-label="Hand">
        {view.hand.map((card) => (
          <li key={card.cardInstanceId}>
            <button
              type="button"
              aria-pressed={draft.kind === 'card' && draft.cardInstanceId === card.cardInstanceId}
              disabled={!card.isPlayableThisRound}
              onClick={() => onSelectCard(card.cardInstanceId, {})}
            >
              {card.name} · Grade {card.grade}
            </button>
            <span> — {card.effectSummary}</span>
            {!card.isPlayableThisRound && <span> (unavailable this round)</span>}
          </li>
        ))}
      </ul>

      <h3>Faction specials</h3>
      <ul aria-label="Faction specials">
        {view.specials.map((special) => (
          <li key={special.specialAction}>
            <button
              type="button"
              aria-pressed={draft.kind === 'special' && draft.specialAction === special.specialAction}
              disabled={!special.available}
              onClick={() => onSelectSpecial(special.specialAction, {})}
            >
              {special.name}
            </button>
            <span> — {special.effectSummary}</span>
            {special.remainingUsesThisEra !== null && (
              <span>
                {' '}
                ({special.remainingUsesThisEra} left this era
                {special.remainingUsesThisGame !== null ? `, ${special.remainingUsesThisGame} this game` : ''})
              </span>
            )}
            {!special.available && special.unavailableReason && <span> ({special.unavailableReason})</span>}
          </li>
        ))}
      </ul>

      {selected && targetMode && targetMode !== 'NONE' && (
        <div aria-label="Choose a target">
          <h3>Choose a target</h3>
          {(targetMode === 'EVENT_OUTCOME' || targetMode === 'EVENT_OUTCOME_PAIR' || targetMode === 'EVENT_ONLY') && (
            <ul aria-label="Events">
              {view.activeEvents.map((event) => (
                <li key={event.eventId}>
                  <button
                    type="button"
                    aria-pressed={coordinates.targetEventId === event.eventId}
                    onClick={() => applyCoordinates({ targetEventId: event.eventId })}
                  >
                    {event.title}
                  </button>
                  {coordinates.targetEventId === event.eventId && targetMode === 'EVENT_OUTCOME' && (
                    <ul aria-label={`${event.title} outcomes`}>
                      {event.outcomes.map((outcome) => (
                        <li key={outcome.outcomeId}>
                          <button
                            type="button"
                            aria-pressed={coordinates.targetOutcomeId === outcome.outcomeId}
                            onClick={() => applyCoordinates({ targetEventId: event.eventId, targetOutcomeId: outcome.outcomeId })}
                          >
                            {outcome.description}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {coordinates.targetEventId === event.eventId && targetMode === 'EVENT_OUTCOME_PAIR' && (
                    <>
                      <p>From</p>
                      <ul aria-label={`${event.title} source outcomes`}>
                        {event.outcomes.map((outcome) => (
                          <li key={outcome.outcomeId}>
                            <button
                              type="button"
                              aria-pressed={coordinates.sourceOutcomeId === outcome.outcomeId}
                              onClick={() => applyCoordinates({ ...coordinates, targetEventId: event.eventId, sourceOutcomeId: outcome.outcomeId })}
                            >
                              {outcome.description}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p>To</p>
                      <ul aria-label={`${event.title} target outcomes`}>
                        {event.outcomes.map((outcome) => (
                          <li key={outcome.outcomeId}>
                            <button
                              type="button"
                              aria-pressed={coordinates.targetOutcomeId === outcome.outcomeId}
                              disabled={outcome.outcomeId === coordinates.sourceOutcomeId}
                              onClick={() => applyCoordinates({ ...coordinates, targetEventId: event.eventId, targetOutcomeId: outcome.outcomeId })}
                            >
                              {outcome.description}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {targetMode === 'EVENT_LIST' && (
            <>
              <p>
                Choose {requiredEventCount} event{requiredEventCount === 1 ? '' : 's'} ({coordinates.targetEventIds?.length ?? 0}/
                {requiredEventCount} selected)
              </p>
              <ul aria-label="Events">
                {view.activeEvents.map((event) => (
                  <li key={event.eventId}>
                    <button type="button" aria-pressed={(coordinates.targetEventIds ?? []).includes(event.eventId)} onClick={() => toggleListEvent(event.eventId)}>
                      {event.title}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {targetMode === 'PLAYER' && (
            <ul aria-label="Players">
              {view.opponents.map((opponent) => (
                <li key={opponent.playerId}>
                  <button
                    type="button"
                    aria-pressed={coordinates.targetPlayerId === opponent.playerId}
                    disabled={!opponent.isConnected}
                    onClick={() => applyCoordinates({ targetPlayerId: opponent.playerId })}
                  >
                    {opponent.playerName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section aria-label="Action confirmation" aria-live="polite" aria-atomic="true">
        <h3>Confirm</h3>
        {selected ? (
          <p>
            {selected.kind === 'card' ? selected.card.name : selected.special.name}
            {isComplete ? ' · target selected' : ' · choose a target'}
          </p>
        ) : (
          <p>Choose an available card or faction special.</p>
        )}
        <button type="button" onClick={onConfirm} disabled={!isComplete || submitPhase.kind === 'submitting'}>
          {submitPhase.kind === 'submitting' ? 'Submitting…' : 'Confirm action'}
        </button>
        {selected && (
          <button type="button" onClick={onClearDraft}>
            Clear selection
          </button>
        )}
        {submitPhase.kind === 'rejected' && (
          <p role="alert">
            {submitPhase.message} Your selection is preserved — adjust it and try again.{' '}
            <button type="button" onClick={onDismissRejection}>
              Dismiss
            </button>
          </p>
        )}
        {submitPhase.kind === 'submitted' && <p role="status">Action submitted.</p>}
        <p>Exact live weights remain hidden. The server validates your action.</p>
      </section>
    </section>
  )
}
