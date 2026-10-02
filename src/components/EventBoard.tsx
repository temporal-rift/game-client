import type { ActionCoordinates } from '../api/action'
import type { TargetMode } from '../action/actionRules'
import { isEventChosen, outcomeRole, targetsEvents, type OutcomeRole } from '../action/actionTargeting'
import type { BoardEvent, BoardOutcome } from '../board/boardView'
import { EventIllustration } from '../illustrations/catalog'
import type { IllustrationSkin } from '../illustrations/catalogData'
import type { OpenParadoxView } from '../paradox/paradoxView'
import { BandLabel } from './BandLabel'
import { CarryOverIcon } from './icons'
import { DeclarationObservation, ExposeObservation, PrivateKnowledge, PrivateProbability } from './BoardKnowledge'
import { revealedKnowledgeKey } from '../knowledge/knowledgeLabels'

/** Present only while the selected card or special targets events or their outcomes. */
export interface EventTargeting {
  readonly targetMode: TargetMode
  readonly coordinates: ActionCoordinates
  readonly disabled: boolean
  readonly onPickEvent: (eventId: string) => void
  readonly onPickOutcome: (eventId: string, outcomeId: string) => void
}

/** Present while a paradox-resolution phase is open: what is affected and, once a card is selected, its target choice. */
export interface EventParadoxMarking {
  readonly affectedEventIds: ReadonlySet<string>
  readonly paradoxes: readonly OpenParadoxView[]
  readonly targeting: {
    readonly chosen: { readonly eventId: string; readonly outcomeId: string } | null
    readonly disabled: boolean
    readonly onPickOutcome: (eventId: string, outcomeId: string) => void
  } | null
}

interface EventBoardProps {
  readonly events: readonly BoardEvent[]
  readonly illustrationSkin?: IllustrationSkin
  readonly targeting?: EventTargeting | null
  readonly paradox?: EventParadoxMarking | null
}

const CARRY_OVER_LABEL: Record<BoardEvent['carryOverState'], string> = {
  FRESH: 'Fresh',
  CASCADED: 'Cascaded',
  STALLED: 'Stalled',
}

const OUTCOME_LIST_SUFFIX: Record<OutcomeRole, string> = {
  outcome: 'outcomes',
  source: 'source outcomes',
  target: 'target outcomes',
}

function OutcomeContent({ outcome, markers }: { readonly outcome: BoardOutcome; readonly markers: readonly string[] }) {
  return (
    <>
      <span className="outcome-label">{outcome.description}</span>
      {markers.map((marker) => (
        <span key={marker} className="outcome-marker">
          {marker}
        </span>
      ))}
      <span className="outcome-band"><span className="knowledge-scope">Public</span><BandLabel band={outcome.band} /></span>
    </>
  )
}

function OutcomeKnowledge({ outcome }: { readonly outcome: BoardOutcome }) {
  if (outcome.privateProbabilities.length === 0 && outcome.declarations.length === 0) return null
  return (
    <div className="outcome-knowledge">
      {outcome.privateProbabilities.map((entry) => <PrivateProbability key={entry.observedInRound} entry={entry} />)}
      {outcome.declarations.map((entry) => <DeclarationObservation key={`${entry.playerId}-${entry.eraNumber}`} entry={entry} />)}
    </div>
  )
}

function EventKnowledge({ event }: { readonly event: BoardEvent }) {
  return (
    <>
      {event.bandsObservedInRound !== null && <p className="event-band-age">Bands from round {event.bandsObservedInRound}</p>}
      {event.traceKnowledge.map((entry) => <PrivateKnowledge key={revealedKnowledgeKey(entry)} entry={entry} />)}
      {event.exposeFacts.map((entry) => <ExposeObservation key={`${entry.activistPlayerId}-${entry.targetPlayerId}-${entry.roundNumber}`} entry={entry} />)}
    </>
  )
}

function PlainOutcomeList({ event, markersFor }: { readonly event: BoardEvent; readonly markersFor: (outcomeId: string) => readonly string[] }) {
  return (
    <ul className="outcome-list" aria-label={`${event.title} outcomes`}>
      {event.outcomes.map((outcome) => (
        <li key={outcome.outcomeId}>
          <div className="outcome-row"><OutcomeContent outcome={outcome} markers={markersFor(outcome.outcomeId)} /></div>
          <OutcomeKnowledge outcome={outcome} />
        </li>
      ))}
    </ul>
  )
}

const NO_MARKERS = (): readonly string[] => []

function outcomeMarker(role: OutcomeRole, coordinates: ActionCoordinates, outcomeId: string): string | null {
  if (role === 'target' && coordinates.sourceOutcomeId === outcomeId) return 'From'
  if (coordinates.targetOutcomeId !== outcomeId) return null
  return role === 'outcome' ? 'Target' : 'To'
}

function OutcomeList({ event, targeting }: { readonly event: BoardEvent; readonly targeting: EventTargeting | null }) {
  const role = targeting ? outcomeRole(targeting.targetMode, targeting.coordinates, event.eventId) : null
  if (!targeting || !role) {
    return <PlainOutcomeList event={event} markersFor={NO_MARKERS} />
  }
  const { coordinates } = targeting
  const onThisEvent = coordinates.targetEventId === event.eventId
  return (
    <ul className="outcome-list is-targetable" aria-label={`${event.title} ${OUTCOME_LIST_SUFFIX[role]}`}>
      {event.outcomes.map((outcome) => {
        const marker = onThisEvent ? outcomeMarker(role, coordinates, outcome.outcomeId) : null
        const isSource = role === 'target' && coordinates.sourceOutcomeId === outcome.outcomeId
        return (
          <li key={outcome.outcomeId}>
            <button
              type="button"
              className="outcome-row"
              aria-pressed={marker !== null}
              disabled={targeting.disabled || isSource}
              onClick={() => targeting.onPickOutcome(event.eventId, outcome.outcomeId)}
            >
              <span className="outcome-radio" aria-hidden="true" />
              <OutcomeContent outcome={outcome} markers={marker ? [marker] : []} />
            </button>
            <OutcomeKnowledge outcome={outcome} />
          </li>
        )
      })}
    </ul>
  )
}

function targetingFooter(event: BoardEvent, targeting: EventTargeting): string {
  if (isEventChosen(targeting.targetMode, targeting.coordinates, event.eventId)) return 'Selected target'
  return outcomeRole(targeting.targetMode, targeting.coordinates, event.eventId) ? 'Choose an outcome to target' : 'Choose this event to target'
}

function EventMeta({ event, eventIndex }: { readonly event: BoardEvent; readonly eventIndex: number }) {
  return (
    <div className="event-card-meta">
      <span>Future {String(eventIndex + 1).padStart(2, '0')}</span>
      <span className="event-status">
        <CarryOverIcon state={event.carryOverState} />
        {CARRY_OVER_LABEL[event.carryOverState]}
      </span>
    </div>
  )
}

function ActionEventGrid({
  events,
  illustrationSkin,
  targeting,
}: {
  readonly events: readonly BoardEvent[]
  readonly illustrationSkin: IllustrationSkin
  readonly targeting: EventTargeting | null
}) {
  return (
    <ol className="event-grid" aria-label={targeting ? 'Events' : undefined}>
      {events.map((event, eventIndex) => {
        const isChosen = targeting ? isEventChosen(targeting.targetMode, targeting.coordinates, event.eventId) : false
        const className = ['event-card', targeting ? 'is-targetable' : '', isChosen ? 'is-selected' : ''].filter(Boolean).join(' ')
        return (
          <li key={event.eventId} className={className}>
            {targeting ? (
              <button
                type="button"
                className="event-select"
                aria-pressed={isChosen}
                aria-label={`Target ${event.title}`}
                disabled={targeting.disabled}
                onClick={() => targeting.onPickEvent(event.eventId)}
              >
                <EventIllustration eventId={event.eventId} skin={illustrationSkin} />
              </button>
            ) : (
              <EventIllustration eventId={event.eventId} skin={illustrationSkin} />
            )}
            <div className="event-card-body">
              <EventMeta event={event} eventIndex={eventIndex} />
              <h3>{event.title}</h3>
              <OutcomeList event={event} targeting={targeting} />
              <EventKnowledge event={event} />
              {targeting && <p className="event-target-hint">{targetingFooter(event, targeting)}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ParadoxOutcomeList({
  event,
  affectedOutcomeIds,
  targeting,
}: {
  readonly event: BoardEvent
  readonly affectedOutcomeIds: ReadonlySet<string>
  readonly targeting: NonNullable<EventParadoxMarking['targeting']>
}) {
  return (
    <ul className="outcome-list is-targetable" aria-label={`${event.title} outcomes`}>
      {event.outcomes.map((outcome) => {
        const isTarget = targeting.chosen?.eventId === event.eventId && targeting.chosen.outcomeId === outcome.outcomeId
        const markers = [affectedOutcomeIds.has(outcome.outcomeId) ? 'Affected' : null, isTarget ? 'Target' : null].filter((marker) => marker !== null)
        return (
          <li key={outcome.outcomeId}>
            <button
              type="button"
              className="outcome-row"
              aria-pressed={isTarget}
              disabled={targeting.disabled}
              onClick={() => targeting.onPickOutcome(event.eventId, outcome.outcomeId)}
            >
              <span className="outcome-radio" aria-hidden="true" />
              <OutcomeContent outcome={outcome} markers={markers} />
            </button>
            <OutcomeKnowledge outcome={outcome} />
          </li>
        )
      })}
    </ul>
  )
}

function ParadoxEventGrid({
  events,
  illustrationSkin,
  paradox,
}: {
  readonly events: readonly BoardEvent[]
  readonly illustrationSkin: IllustrationSkin
  readonly paradox: EventParadoxMarking
}) {
  const { targeting } = paradox
  return (
    <ol className="event-grid">
      {events.map((event, eventIndex) => {
        const isAffected = paradox.affectedEventIds.has(event.eventId)
        const eventParadoxes = isAffected ? paradox.paradoxes.filter((entry) => entry.affectedEventId === event.eventId) : []
        const affectedOutcomeIds = new Set(eventParadoxes.flatMap((entry) => entry.affectedOutcomeIds))
        const isChosen = targeting?.chosen?.eventId === event.eventId
        const className = ['event-card', isAffected ? 'is-affected' : '', isChosen ? 'is-selected' : ''].filter(Boolean).join(' ')
        return (
          <li key={event.eventId} className={className}>
            <EventIllustration eventId={event.eventId} skin={illustrationSkin} />
            <div className="event-card-body">
              <EventMeta event={event} eventIndex={eventIndex} />
              {isAffected && (
                <ul className="paradox-badges" aria-label={`${event.title} paradoxes`}>
                  {eventParadoxes.length === 0 ? (
                    <li className="paradox-badge">Paradox</li>
                  ) : (
                    eventParadoxes.map((entry) => (
                      <li key={entry.paradoxId} className="paradox-badge">
                        {entry.typeLabel}
                      </li>
                    ))
                  )}
                </ul>
              )}
              <h3>{event.title}</h3>
              {isAffected && targeting ? (
                <ParadoxOutcomeList event={event} affectedOutcomeIds={affectedOutcomeIds} targeting={targeting} />
              ) : (
                <PlainOutcomeList event={event} markersFor={(outcomeId) => (affectedOutcomeIds.has(outcomeId) ? ['Affected'] : [])} />
              )}
              <EventKnowledge event={event} />
              {isAffected && targeting && (
                <p className="event-target-hint">{isChosen ? 'Selected target' : 'Choose an outcome to target'}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function EventBoard({ events, illustrationSkin = 'board', targeting = null, paradox = null }: EventBoardProps) {
  const activeTargeting = targeting && targetsEvents(targeting.targetMode) ? targeting : null
  let content
  if (paradox) {
    const grid = <ParadoxEventGrid events={events} illustrationSkin={illustrationSkin} paradox={paradox} />
    content = paradox.targeting ? (
      <fieldset className="target-group" aria-label="Affected events">
        {grid}
      </fieldset>
    ) : (
      grid
    )
  } else {
    const grid = <ActionEventGrid events={events} illustrationSkin={illustrationSkin} targeting={activeTargeting} />
    content = activeTargeting ? (
      <fieldset className="target-group" aria-label="Choose a target">
        {grid}
      </fieldset>
    ) : (
      grid
    )
  }
  return (
    <section className="event-board" aria-labelledby="event-board-heading">
      <div className="section-heading-row">
        <h2 id="event-board-heading">The active futures</h2>
        <span>Public bands · earned intel stays private</span>
      </div>
      {content}
    </section>
  )
}
