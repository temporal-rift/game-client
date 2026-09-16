import type { EventBoardEntry } from '../types/playerView'

interface EventBoardProps {
  readonly events: readonly EventBoardEntry[]
}

export function EventBoard({ events }: EventBoardProps) {
  return (
    <section aria-labelledby="event-board-heading">
      <h2 id="event-board-heading">Event board</h2>
      <ol>
        {events.map((event) => (
          <li key={event.id}>
            <span>{event.title}</span>
            <span> — era {event.era}</span>
            <span> — {event.status}</span>
            <span> — band {event.publicBand}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
