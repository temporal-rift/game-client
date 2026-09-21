import type { ActionCoordinates, SpecialAction } from '../api/actionClient'
import type { ActionDraft, SubmitPhase } from '../action/useActionSubmission'
import type { ActionRoundView, ActiveEventOption, HandCardOption, OpponentOption, SpecialActionOption } from '../action/actionView'
import { scanEventCountForGrade, type TargetMode } from '../action/actionRules'

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

function selectedOptionFor(view: Extract<ActionRoundView, { kind: 'open' }>, draft: ActionDraft): Selected {
  if (draft.kind === 'card') {
    const card = view.hand.find((entry) => entry.cardInstanceId === draft.cardInstanceId)
    return card ? { kind: 'card', card } : null
  }
  if (draft.kind === 'special') {
    const special = view.specials.find((entry) => entry.specialAction === draft.specialAction)
    return special ? { kind: 'special', special } : null
  }
  return null
}

function targetModeFor(selected: Selected): TargetMode | null {
  if (!selected) {
    return null
  }
  return selected.kind === 'card' ? selected.card.targetMode : selected.special.targetMode
}

function coordinatesComplete(mode: TargetMode, coordinates: ActionCoordinates, requiredEventCount: number): boolean {
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
  }
}

interface EventOutcomeTargetProps {
  readonly targetMode: 'EVENT_OUTCOME' | 'EVENT_OUTCOME_PAIR' | 'EVENT_ONLY'
  readonly activeEvents: readonly ActiveEventOption[]
  readonly coordinates: ActionCoordinates
  readonly onApply: (next: ActionCoordinates) => void
}

function EventOutcomeTarget({ targetMode, activeEvents, coordinates, onApply }: EventOutcomeTargetProps) {
  return (
    <ul aria-label="Events">
      {activeEvents.map((event) => {
        const isSelectedEvent = coordinates.targetEventId === event.eventId
        return (
          <li key={event.eventId}>
            <button type="button" aria-pressed={isSelectedEvent} onClick={() => onApply({ targetEventId: event.eventId })}>
              {event.title}
            </button>
            {isSelectedEvent && targetMode === 'EVENT_OUTCOME' && (
              <ul aria-label={`${event.title} outcomes`}>
                {event.outcomes.map((outcome) => (
                  <li key={outcome.outcomeId}>
                    <button
                      type="button"
                      aria-pressed={coordinates.targetOutcomeId === outcome.outcomeId}
                      onClick={() => onApply({ targetEventId: event.eventId, targetOutcomeId: outcome.outcomeId })}
                    >
                      {outcome.description}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {isSelectedEvent && targetMode === 'EVENT_OUTCOME_PAIR' && (
              <>
                <p>From</p>
                <ul aria-label={`${event.title} source outcomes`}>
                  {event.outcomes.map((outcome) => (
                    <li key={outcome.outcomeId}>
                      <button
                        type="button"
                        aria-pressed={coordinates.sourceOutcomeId === outcome.outcomeId}
                        onClick={() => onApply({ ...coordinates, targetEventId: event.eventId, sourceOutcomeId: outcome.outcomeId })}
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
                        onClick={() => onApply({ ...coordinates, targetEventId: event.eventId, targetOutcomeId: outcome.outcomeId })}
                      >
                        {outcome.description}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}

interface EventListTargetProps {
  readonly activeEvents: readonly ActiveEventOption[]
  readonly requiredEventCount: number
  readonly coordinates: ActionCoordinates
  readonly onToggle: (eventId: string) => void
}

function EventListTarget({ activeEvents, requiredEventCount, coordinates, onToggle }: EventListTargetProps) {
  const selectedCount = coordinates.targetEventIds?.length ?? 0
  return (
    <>
      <p>
        Choose {requiredEventCount} event{requiredEventCount === 1 ? '' : 's'} ({selectedCount}/{requiredEventCount} selected)
      </p>
      <ul aria-label="Events">
        {activeEvents.map((event) => (
          <li key={event.eventId}>
            <button type="button" aria-pressed={(coordinates.targetEventIds ?? []).includes(event.eventId)} onClick={() => onToggle(event.eventId)}>
              {event.title}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

interface PlayerTargetProps {
  readonly opponents: readonly OpponentOption[]
  readonly coordinates: ActionCoordinates
  readonly onApply: (next: ActionCoordinates) => void
}

function PlayerTarget({ opponents, coordinates, onApply }: PlayerTargetProps) {
  return (
    <ul aria-label="Players">
      {opponents.map((opponent) => (
        <li key={opponent.playerId}>
          <button
            type="button"
            aria-pressed={coordinates.targetPlayerId === opponent.playerId}
            disabled={!opponent.isConnected}
            onClick={() => onApply({ targetPlayerId: opponent.playerId })}
          >
            {opponent.playerName}
          </button>
        </li>
      ))}
    </ul>
  )
}

interface TargetPickerProps {
  readonly targetMode: TargetMode
  readonly activeEvents: readonly ActiveEventOption[]
  readonly opponents: readonly OpponentOption[]
  readonly requiredEventCount: number
  readonly coordinates: ActionCoordinates
  readonly onApply: (next: ActionCoordinates) => void
  readonly onToggleListEvent: (eventId: string) => void
}

function TargetPicker({ targetMode, activeEvents, opponents, requiredEventCount, coordinates, onApply, onToggleListEvent }: TargetPickerProps) {
  if (targetMode === 'NONE') {
    return null
  }
  return (
    <div aria-label="Choose a target">
      <h3>Choose a target</h3>
      {(targetMode === 'EVENT_OUTCOME' || targetMode === 'EVENT_OUTCOME_PAIR' || targetMode === 'EVENT_ONLY') && (
        <EventOutcomeTarget targetMode={targetMode} activeEvents={activeEvents} coordinates={coordinates} onApply={onApply} />
      )}
      {targetMode === 'EVENT_LIST' && (
        <EventListTarget activeEvents={activeEvents} requiredEventCount={requiredEventCount} coordinates={coordinates} onToggle={onToggleListEvent} />
      )}
      {targetMode === 'PLAYER' && <PlayerTarget opponents={opponents} coordinates={coordinates} onApply={onApply} />}
    </div>
  )
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
        <output>Your action is submitted for this round. Private until round closure.</output>
      </section>
    )
  }

  const selected = selectedOptionFor(view, draft)
  const targetMode = targetModeFor(selected)
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
    if (current.includes(eventId)) {
      applyCoordinates({ targetEventIds: current.filter((id) => id !== eventId) })
      return
    }
    if (current.length < requiredEventCount) {
      applyCoordinates({ targetEventIds: [...current, eventId] })
    }
  }

  const isComplete = selected !== null && targetMode !== null && coordinatesComplete(targetMode, coordinates, requiredEventCount)
  const selectedName = selected === null ? null : selected.kind === 'card' ? selected.card.name : selected.special.name

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

      {selected && targetMode && (
        <TargetPicker
          targetMode={targetMode}
          activeEvents={view.activeEvents}
          opponents={view.opponents}
          requiredEventCount={requiredEventCount}
          coordinates={coordinates}
          onApply={applyCoordinates}
          onToggleListEvent={toggleListEvent}
        />
      )}

      <section aria-label="Action confirmation" aria-live="polite" aria-atomic="true">
        <h3>Confirm</h3>
        {selectedName ? (
          <p>
            {selectedName}
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
        {submitPhase.kind === 'submitted' && <output>Action submitted.</output>}
        <p>Exact live weights remain hidden. The server validates your action.</p>
      </section>
    </section>
  )
}
