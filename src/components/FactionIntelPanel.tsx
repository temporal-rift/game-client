import type { BoardFaction, BoardSpecial } from '../board/boardView'
import { FactionIllustration } from '../illustrations/catalog'
import type { IllustrationSkin } from '../illustrations/catalogData'
import { FactionEmblem } from './icons'

interface FactionIntelPanelProps {
  readonly faction: BoardFaction
  readonly illustrationSkin?: IllustrationSkin
}

function remainingUsesLabel({ remainingThisEra, remainingThisGame }: BoardSpecial): string | null {
  if (remainingThisEra === null && remainingThisGame === null) {
    return null
  }
  return `${remainingThisEra ?? '–'} this era · ${remainingThisGame ?? '–'} this game`
}

export function FactionIntelPanel({ faction, illustrationSkin = 'board' }: FactionIntelPanelProps) {
  return (
    <aside className="faction-rail" aria-labelledby="faction-intel-heading">
      <section className="faction-panel">
        <h2 id="faction-intel-heading" className="panel-eyebrow">
          Your faction
        </h2>
        {faction.faction && illustrationSkin !== 'board' ? (
          <FactionIllustration faction={faction.faction} skin={illustrationSkin} />
        ) : (
          <FactionEmblem />
        )}
        <p className="faction-name">{faction.factionName ?? 'No faction assigned yet'}</p>
        <div className="faction-score">
          <span>Your score</span>
          <p>
            <strong>{faction.score}</strong>
            <span>/ {faction.winScoreThreshold} to win</span>
          </p>
        </div>
        {faction.specials.length > 0 && (
          <ul className="faction-specials" aria-label="Faction special uses">
            {faction.specials.map((special) => {
              const remaining = remainingUsesLabel(special)
              return (
                <li key={special.specialAction} className="faction-special">
                  <strong>{special.name}</strong>
                  {remaining && <span>{remaining}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </aside>
  )
}
