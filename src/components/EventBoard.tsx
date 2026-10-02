import type { ActionCoordinates } from '../api/action'
import type { TargetMode } from '../action/actionRules'
import { isEventChosen, outcomeRole, targetsEvents, type OutcomeRole } from '../action/actionTargeting'
import type { BoardEvent, BoardOutcome } from '../board/boardView'
import { EventIllustration } from '../illustrations/catalog'
import type { IllustrationSkin } from '../illustrations/catalogData'
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

interface EventBoardProps {
  readonly events: readonly BoardEvent[]
  readonly illustrationSkin?: IllustrationSkin
  readonly targeting?: EventTargeting | null
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

function OutcomeContent({ outcome, marker }: { readonly outcome: BoardOutcome; readonly marker: string | null }) {
  return (
    <>
      <span className="outcome-label">{outcome.description}</span>
      {marker && <span className="outcome-marker">{marker}</span>}
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

function outcomeMarker(role: OutcomeRole, coordinates: ActionCoordinates, outcomeId: string): string | null {
  if (role === 'target' && coordinates.sourceOutcomeId === outcomeId) return 'From'
  if (coordinates.targetOutcomeId !== outcomeId) return null
  return role === 'outcome' ? 'Target' : 'To'
}

function OutcomeList({ event, targeting }: { readonly event: BoardEvent; readonly targeting: EventTargeting | null }) {
  const role = targeting ? outcomeRole(targeting.targetMode, targeting.coordinates, event.eventId) : null
  if (!targeting || !role) {
    return (
      <ul className="outcome-list" aria-label={`${event.title} outcomes`}>
        {event.outcomes.map((outcome) => (
          <li key={outcome.outcomeId}>
            <div className="outcome-row"><OutcomeContent outcome={outcome} marker={null} /></div>
            <OutcomeKnowledge outcome={outcome} />
          </li>
        ))}
      </ul>
    )
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
              <OutcomeContent outcome={outcome} marker={marker} />
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

export function EventBoard({ events, illustrationSkin = 'board', targeting = null }: EventBoardProps) {
  const activeTargeting = targeting && targetsEvents(targeting.targetMode) ? targeting : null
  const grid = (
    <ol className="event-grid" aria-label={activeTargeting ? 'Events' : undefined}>
      {events.map((event, eventIndex) => {
        const isChosen = activeTargeting ? isEventChosen(activeTargeting.targetMode, activeTargeting.coordinates, event.eventId) : false
        const className = ['event-card', activeTargeting ? 'is-targetable' : '', isChosen ? 'is-selected' : ''].filter(Boolean).join(' ')
        return (
          <li key={event.eventId} className={className}>
            {activeTargeting ? (
              <button
                type="button"
                className="event-select"
                aria-pressed={isChosen}
                aria-label={`Target ${event.title}`}
                disabled={activeTargeting.disabled}
                onClick={() => activeTargeting.onPickEvent(event.eventId)}
              >
                <EventIllustration eventId={event.eventId} skin={illustrationSkin} />
              </button>
            ) : (
              <EventIllustration eventId={event.eventId} skin={illustrationSkin} />
            )}
            <div className="event-card-body">
              <div className="event-card-meta">
                <span>Future {String(eventIndex + 1).padStart(2, '0')}</span>
                <span className="event-status">
                  <CarryOverIcon state={event.carryOverState} />
                  {CARRY_OVER_LABEL[event.carryOverState]}
                </span>
              </div>
              <h3>{event.title}</h3>
              <OutcomeList event={event} targeting={activeTargeting} />
              {event.bandsObservedInRound !== null && <p className="event-band-age">Bands from round {event.bandsObservedInRound}</p>}
              {event.traceKnowledge.map((entry) => <PrivateKnowledge key={revealedKnowledgeKey(entry)} entry={entry} />)}
              {event.exposeFacts.map((entry) => <ExposeObservation key={`${entry.activistPlayerId}-${entry.targetPlayerId}-${entry.roundNumber}`} entry={entry} />)}
              {activeTargeting && <p className="event-target-hint">{targetingFooter(event, activeTargeting)}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
  return (
    <section className="event-board" aria-labelledby="event-board-heading">
      <div className="section-heading-row">
        <h2 id="event-board-heading">The active futures</h2>
        <span>Public bands · earned intel stays private</span>
      </div>
      {activeTargeting ? (
        <fieldset className="target-group" aria-label="Choose a target">
          {grid}
        </fieldset>
      ) : (
        grid
      )}
    </section>
  )
}
