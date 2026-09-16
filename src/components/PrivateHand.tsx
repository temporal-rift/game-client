import type { HandCard } from '../types/playerView'

interface PrivateHandProps {
  readonly hand: readonly HandCard[]
}

export function PrivateHand({ hand }: PrivateHandProps) {
  return (
    <section aria-labelledby="private-hand-heading">
      <h2 id="private-hand-heading">Private hand</h2>
      <ul>
        {hand.map((card) => (
          <li key={card.id}>
            <span>{card.name}</span>
            <span> — grade {card.grade}</span>
            <p>{card.description}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
