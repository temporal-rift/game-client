import type { EventBoardEntry } from '../types/playerView'
import { EventIllustration } from '../illustrations/catalog'
import type { IllustrationSkin } from '../illustrations/catalogData'
import { BandLabel } from './BandLabel'
import { EventSceneArt, EventStatusIcon } from './icons'

const LEGACY_BOARD_EVENT_IDS = new Set([
  '12606191-eafe-4d1c-a014-b676bf094db0',
  '400e3361-301f-4ec1-9edd-cb0c6e14fbc6',
  'ab0d99ea-6f75-4d8d-b1a7-7a1a063635a4',
])

interface EventBoardProps {
  readonly events: readonly EventBoardEntry[]
  readonly publicBandAgeLabel: string
  readonly selectedTargetId: string | null
  readonly onSelectTarget: (id: string) => void
  readonly illustrationSkin?: IllustrationSkin
}

const STATUS_LABEL: Record<EventBoardEntry['status'], string> = {
  resolved: 'Resolved',
  'in-progress': 'Active',
  upcoming: 'Upcoming',
}

function instructionFor(hasSelectedOutcome: boolean, status: EventBoardEntry['status']): string {
  if (hasSelectedOutcome) {
    return 'Selected target'
  }
  if (status === 'resolved') {
    return 'Event resolved'
  }
  return 'Choose an outcome to target'
}

export function EventBoard({ events, publicBandAgeLabel, selectedTargetId, onSelectTarget, illustrationSkin = 'board' }: EventBoardProps) {
  return (
    <section className="event-board" aria-labelledby="event-board-heading">
      <div className="section-heading-row">
        <h2 id="event-board-heading">The active futures</h2>
        <span>{publicBandAgeLabel}</span>
      </div>
      <ol className="event-grid">
        {events.map((event, eventIndex) => {
          const hasSelectedOutcome = event.outcomes.some((outcome) => outcome.id === selectedTargetId)
          return (
            <li key={event.id}>
              <article className={`event-card${hasSelectedOutcome ? ' is-selected' : ''}`}>
                {illustrationSkin === 'board' && LEGACY_BOARD_EVENT_IDS.has(event.id) ? <EventSceneArt artwork={event.artwork} /> : <EventIllustration eventId={event.id} skin={illustrationSkin} />}
                <div className="event-card-body">
                  <div className="event-card-meta">
                    <span>Future {String(eventIndex + 1).padStart(2, '0')}</span>
                    <span className="event-status">
                      <EventStatusIcon status={event.status} />
                      {STATUS_LABEL[event.status]}
                    </span>
                  </div>
                  <h3>{event.title}</h3>
                  <ul className="outcome-list" aria-label={`${event.title} outcomes`}>
                    {event.outcomes.map((outcome) => {
                      const isSelected = outcome.id === selectedTargetId
                      return (
                        <li key={outcome.id}>
                          <button
                            type="button"
                            className="outcome-button"
                            aria-pressed={isSelected}
                            disabled={!outcome.isValidTarget}
                            onClick={() => onSelectTarget(outcome.id)}
                          >
                            <span className="outcome-choice" aria-hidden="true" />
                            <span className="outcome-label">{outcome.label}</span>
                            <BandLabel band={outcome.publicBand} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="event-card-instruction">{instructionFor(hasSelectedOutcome, event.status)}</p>
                </div>
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
