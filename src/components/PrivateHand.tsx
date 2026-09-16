import type { HandCard } from '../types/playerView'
import { GradeBadge } from './icons'

interface PrivateHandProps {
  readonly hand: readonly HandCard[]
  readonly selectedCardId: string | null
  readonly onSelectCard: (id: string) => void
}

export function PrivateHand({ hand, selectedCardId, onSelectCard }: PrivateHandProps) {
  return (
    <section aria-labelledby="private-hand-heading">
      <h2 id="private-hand-heading">Private hand</h2>
      <ul className="card-grid">
        {hand.map((card) => {
          const isSelected = card.id === selectedCardId
          return (
            <li key={card.id}>
              <button type="button" className="board-tile" aria-pressed={isSelected} onClick={() => onSelectCard(card.id)}>
                <GradeBadge grade={card.grade} />
                <span className="board-tile-title">{card.name}</span>
                <p>{card.description}</p>
                {isSelected && <span className="selection-flag">Selected card</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
