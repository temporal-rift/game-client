import type { HandCard } from '../types/playerView'
import { CardGlyph, GradeBadge } from './icons'

interface PrivateHandProps {
  readonly hand: readonly HandCard[]
  readonly selectedCardId: string | null
  readonly onSelectCard: (id: string) => void
}

export function PrivateHand({ hand, selectedCardId, onSelectCard }: PrivateHandProps) {
  return (
    <section className="private-hand" aria-labelledby="private-hand-heading">
      <div className="section-heading-row">
        <h2 id="private-hand-heading">Your hand</h2>
        <span>{hand.length} cards · choose one action</span>
      </div>
      <ul className="hand-grid">
        {hand.map((card) => {
          const isSelected = card.id === selectedCardId
          return (
            <li key={card.id}>
              <button
                type="button"
                className="hand-card"
                aria-pressed={isSelected}
                disabled={!card.isAvailable}
                onClick={() => onSelectCard(card.id)}
              >
                <span className="hand-card-topline">
                  <span className="hand-card-state">
                    {isSelected ? 'Selected' : card.isAvailable ? 'Card' : card.unavailableReason ?? 'Unavailable'}
                  </span>
                  <GradeBadge grade={card.grade} />
                </span>
                <span className="card-glyph-well">
                  <CardGlyph kind={card.kind} />
                </span>
                <span className="hand-card-name">{card.name}</span>
                <span className="hand-card-description">{card.description}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
