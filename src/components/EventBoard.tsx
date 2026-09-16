import type { EventBoardEntry } from '../types/playerView'
import { BandMeter } from './BandMeter'
import { EventStatusIcon } from './icons'

interface EventBoardProps {
  readonly events: readonly EventBoardEntry[]
  readonly selectedTargetId: string | null
  readonly onSelectTarget: (id: string) => void
}

const STATUS_LABEL: Record<EventBoardEntry['status'], string> = {
  resolved: 'Resolved',
  'in-progress': 'In progress',
  upcoming: 'Upcoming',
}

export function EventBoard({ events, selectedTargetId, onSelectTarget }: EventBoardProps) {
  return (
    <section aria-labelledby="event-board-heading">
      <h2 id="event-board-heading">Event board</h2>
      <ol className="card-grid">
        {events.map((event) => {
          const isSelected = event.id === selectedTargetId
          return (
            <li key={event.id}>
              <button
                type="button"
                className="board-tile"
                aria-pressed={isSelected}
                disabled={!event.isValidTarget}
                onClick={() => onSelectTarget(event.id)}
              >
                <span className="board-tile-status">
                  <EventStatusIcon status={event.status} />
                  <span>{STATUS_LABEL[event.status]}</span>
                </span>
                <span className="board-tile-title">{event.title}</span>
                <span className="board-tile-era">Era {event.era}</span>
                <BandMeter band={event.publicBand} />
                {isSelected && <span className="selection-flag">Selected target</span>}
                {!event.isValidTarget && <span className="board-tile-note">Not a legal target</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
