import type { ActionCoordinates, CardCategory, SpecialAction } from '../api/action'
import type { ActionDraft, SubmitPhase } from '../action/useActionSubmission'
import type { ActionRoundView, ActiveEventOption, HandCardOption, OpponentOption, SpecialActionOption } from '../action/actionView'
import { CARD_CATEGORIES, cardCategoryDisplayName, type TargetMode } from '../action/actionRules'

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

function selectedNameFor(selected: Selected): string | null {
  if (!selected) {
    return null
  }
  return selected.kind === 'card' ? selected.card.name : selected.special.name
}

function coordinatesComplete(mode: TargetMode, coordinates: ActionCoordinates, requiredListSize: number): boolean {
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
      return (coordinates.targetEventIds?.length ?? 0) === requiredListSize
    case 'PLAYER':
      return Boolean(coordinates.targetPlayerId)
    case 'PLAYER_LIST':
      return (coordinates.targetPlayerIds?.length ?? 0) === requiredListSize
    case 'EVENT_ONLY':
      return Boolean(coordinates.targetEventId)
    case 'DISGUISE':
      return coordinates.disguiseCategory !== undefined && (CARD_CATEGORIES as readonly string[]).includes(coordinates.disguiseCategory)
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

interface PlayerListTargetProps {
  readonly opponents: readonly OpponentOption[]
  readonly requiredPlayerCount: number
  readonly coordinates: ActionCoordinates
  readonly onToggle: (playerId: string) => void
}

function PlayerListTarget({ opponents, requiredPlayerCount, coordinates, onToggle }: PlayerListTargetProps) {
  const selected = coordinates.targetPlayerIds ?? []
  return (
    <>
      <p>
        Choose {requiredPlayerCount} player{requiredPlayerCount === 1 ? '' : 's'} ({selected.length}/{requiredPlayerCount} selected)
      </p>
      <ul aria-label="Players">
        {opponents.map((opponent) => (
          <li key={opponent.playerId}>
            <button
              type="button"
              aria-pressed={selected.includes(opponent.playerId)}
              disabled={!opponent.isConnected}
              onClick={() => onToggle(opponent.playerId)}
            >
              {opponent.playerName}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

interface DisguiseCategoryTargetProps {
  readonly coordinates: ActionCoordinates
  readonly onApply: (next: ActionCoordinates) => void
}

function DisguiseCategoryTarget({ coordinates, onApply }: DisguiseCategoryTargetProps) {
  return (
    <>
      <p>Choose a disguise category shown in the round summary instead of this card.</p>
      <ul aria-label="Disguise categories">
        {CARD_CATEGORIES.map((category: CardCategory) => (
          <li key={category}>
            <button type="button" aria-pressed={coordinates.disguiseCategory === category} onClick={() => onApply({ disguiseCategory: category })}>
              {cardCategoryDisplayName(category)}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

interface TargetPickerProps {
  readonly targetMode: TargetMode
  readonly activeEvents: readonly ActiveEventOption[]
  readonly opponents: readonly OpponentOption[]
  readonly requiredListSize: number
  readonly coordinates: ActionCoordinates
  readonly onApply: (next: ActionCoordinates) => void
  readonly onToggleListEvent: (eventId: string) => void
  readonly onToggleListPlayer: (playerId: string) => void
}

function TargetPicker({
  targetMode,
  activeEvents,
  opponents,
  requiredListSize,
  coordinates,
  onApply,
  onToggleListEvent,
  onToggleListPlayer,
}: TargetPickerProps) {
  if (targetMode === 'NONE') {
    return null
  }
  if (targetMode === 'DISGUISE') {
    return (
      <div aria-label="Choose a disguise">
        <h3>Choose a disguise</h3>
        <DisguiseCategoryTarget coordinates={coordinates} onApply={onApply} />
      </div>
    )
  }
  return (
    <div aria-label="Choose a target">
      <h3>Choose a target</h3>
      {(targetMode === 'EVENT_OUTCOME' || targetMode === 'EVENT_OUTCOME_PAIR' || targetMode === 'EVENT_ONLY') && (
        <EventOutcomeTarget targetMode={targetMode} activeEvents={activeEvents} coordinates={coordinates} onApply={onApply} />
      )}
      {targetMode === 'EVENT_LIST' && (
        <EventListTarget activeEvents={activeEvents} requiredEventCount={requiredListSize} coordinates={coordinates} onToggle={onToggleListEvent} />
      )}
      {targetMode === 'PLAYER' && <PlayerTarget opponents={opponents} coordinates={coordinates} onApply={onApply} />}
      {targetMode === 'PLAYER_LIST' && (
        <PlayerListTarget opponents={opponents} requiredPlayerCount={requiredListSize} coordinates={coordinates} onToggle={onToggleListPlayer} />
      )}
    </div>
  )
}

function confirmationStatusText(isComplete: boolean, needsDisguise: boolean): string {
  if (isComplete) {
    return needsDisguise ? ' · disguise selected' : ' · target selected'
  }
  return needsDisguise ? ' · choose a disguise' : ' · choose a target'
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
  const requiredListSize = selected?.kind === 'card' ? (selected.card.targetListSize ?? 0) : 0
  const coordinates: ActionCoordinates = draft.kind === 'none' ? {} : draft.coordinates

  function applyCoordinates(next: ActionCoordinates): void {
    if (draft.kind === 'card') {
      onSelectCard(draft.cardInstanceId, next)
    } else if (draft.kind === 'special') {
      onSelectSpecial(draft.specialAction, next)
    }
  }

  function toggledList(current: readonly string[], id: string): string[] {
    if (current.includes(id)) {
      return current.filter((entry) => entry !== id)
    }
    return current.length < requiredListSize ? [...current, id] : [...current]
  }

  function toggleListEvent(eventId: string): void {
    applyCoordinates({ targetEventIds: toggledList(coordinates.targetEventIds ?? [], eventId) })
  }

  function toggleListPlayer(playerId: string): void {
    applyCoordinates({ targetPlayerIds: toggledList(coordinates.targetPlayerIds ?? [], playerId) })
  }

  const isComplete = selected !== null && targetMode !== null && coordinatesComplete(targetMode, coordinates, requiredListSize)
  const selectedName = selectedNameFor(selected)
  const needsDisguise = targetMode === 'DISGUISE'

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
          requiredListSize={requiredListSize}
          coordinates={coordinates}
          onApply={applyCoordinates}
          onToggleListEvent={toggleListEvent}
          onToggleListPlayer={toggleListPlayer}
        />
      )}

      <section aria-label="Action confirmation" aria-live="polite" aria-atomic="true">
        <h3>Confirm</h3>
        {selectedName ? (
          <p>
            {selectedName}
            {confirmationStatusText(isComplete, needsDisguise)}
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
