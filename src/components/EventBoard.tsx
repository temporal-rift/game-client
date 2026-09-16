import type { EventBoardEntry } from '../types/playerView'
import { BandLabel } from './BandLabel'
import { EventSceneArt, EventStatusIcon } from './icons'

interface EventBoardProps {
  readonly events: readonly EventBoardEntry[]
  readonly publicBandAgeLabel: string
  readonly selectedTargetId: string | null
  readonly onSelectTarget: (id: string) => void
}

const STATUS_LABEL: Record<EventBoardEntry['status'], string> = {
  resolved: 'Resolved',
  'in-progress': 'Active',
  upcoming: 'Upcoming',
}

export function EventBoard({ events, publicBandAgeLabel, selectedTargetId, onSelectTarget }: EventBoardProps) {
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
                <EventSceneArt artwork={event.artwork} />
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
                  <p className="event-card-instruction">
                    {hasSelectedOutcome ? 'Selected target' : event.status === 'resolved' ? 'Event resolved' : 'Choose an outcome to target'}
                  </p>
                </div>
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
