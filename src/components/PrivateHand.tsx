import type { BoardHandCard } from '../board/boardView'
import { CardIllustration } from '../illustrations/catalog'
import type { IllustrationSkin } from '../illustrations/catalogData'
import { GradeBadge } from './icons'

interface PrivateHandProps {
  readonly hand: readonly BoardHandCard[]
  readonly illustrationSkin?: IllustrationSkin
}

export function PrivateHand({ hand, illustrationSkin = 'board' }: PrivateHandProps) {
  return (
    <section className="private-hand" aria-labelledby="private-hand-heading">
      <div className="section-heading-row">
        <h2 id="private-hand-heading">Your hand</h2>
        <span>{hand.length} cards · private to you</span>
      </div>
      <ul className="hand-grid">
        {hand.map((card) => (
          <li key={card.cardInstanceId} className={`hand-card${card.isPlayableThisRound ? '' : ' is-unplayable'}`}>
            <span className="hand-card-topline">
              <span className="hand-card-state">{card.isPlayableThisRound ? 'Playable' : 'Not playable this round'}</span>
              <GradeBadge grade={card.grade} />
            </span>
            <span className="card-glyph-well">
              <CardIllustration cardType={card.cardType} skin={illustrationSkin} />
            </span>
            <span className="hand-card-name">{card.name}</span>
            <span className="hand-card-description">{card.effect}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
