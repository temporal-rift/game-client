import type { BoardEvent } from '../board/boardView'
import { EventIllustration } from '../illustrations/catalog'
import type { IllustrationSkin } from '../illustrations/catalogData'
import { BandLabel } from './BandLabel'
import { CarryOverIcon } from './icons'

interface EventBoardProps {
  readonly events: readonly BoardEvent[]
  readonly illustrationSkin?: IllustrationSkin
}

const CARRY_OVER_LABEL: Record<BoardEvent['carryOverState'], string> = {
  FRESH: 'Fresh',
  CASCADED: 'Cascaded',
  STALLED: 'Stalled',
}

function bandAgeLabel(observedInRound: number | null): string {
  return observedInRound === null ? 'No public bands yet' : `Bands from round ${observedInRound}`
}

export function EventBoard({ events, illustrationSkin = 'board' }: EventBoardProps) {
  return (
    <section className="event-board" aria-labelledby="event-board-heading">
      <div className="section-heading-row">
        <h2 id="event-board-heading">The active futures</h2>
        <span>Public bands · exact weights stay hidden</span>
      </div>
      <ol className="event-grid">
        {events.map((event, eventIndex) => (
          <li key={event.eventId}>
            <article className="event-card">
              <EventIllustration eventId={event.eventId} skin={illustrationSkin} />
              <div className="event-card-body">
                <div className="event-card-meta">
                  <span>Future {String(eventIndex + 1).padStart(2, '0')}</span>
                  <span className="event-status">
                    <CarryOverIcon state={event.carryOverState} />
                    {CARRY_OVER_LABEL[event.carryOverState]}
                  </span>
                </div>
                <h3>{event.title}</h3>
                <ul className="outcome-list" aria-label={`${event.title} outcomes`}>
                  {event.outcomes.map((outcome) => (
                    <li key={outcome.outcomeId} className="outcome-row">
                      <span className="outcome-label">{outcome.description}</span>
                      <BandLabel band={outcome.band} />
                    </li>
                  ))}
                </ul>
                <p className="event-band-age">{bandAgeLabel(event.bandsObservedInRound)}</p>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </section>
  )
}
