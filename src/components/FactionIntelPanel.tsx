import type { FactionIntel } from '../types/playerView'
import { FactionEmblem, KnowledgeScopeIcon } from './icons'

interface FactionIntelPanelProps {
  readonly faction: FactionIntel
}

export function FactionIntelPanel({ faction }: FactionIntelPanelProps) {
  return (
    <aside className="faction-rail" aria-labelledby="faction-intel-heading">
      <section className="faction-panel">
        <h2 id="faction-intel-heading" className="panel-eyebrow">
          Your faction
        </h2>
        <FactionEmblem />
        <p className="faction-name">{faction.factionName}</p>
        <p className="faction-description">{faction.description}</p>
        <div className="faction-score">
          <span>Your score</span>
          <p>
            <strong>{faction.score}</strong>
            <span>/ {faction.scoreThreshold} threshold</span>
          </p>
        </div>
        <p className="faction-special">
          {faction.specialName} · {faction.specialRemainingUses} remaining
        </p>
        <ul className="knowledge-list">
          {faction.knowledge.map((item) => (
            <li key={item.id} className={`knowledge-card knowledge-${item.scope}`}>
              <span className="knowledge-scope">
                <KnowledgeScopeIcon scope={item.scope} />
                {item.scope === 'private' ? 'Private intel' : 'Public intel'}
              </span>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
              <small>{item.ageLabel}</small>
            </li>
          ))}
        </ul>
      </section>
      <section className="factions-in-game" aria-labelledby="factions-in-game-heading">
        <h3 id="factions-in-game-heading">Factions in this game</h3>
        <p>{faction.factionsInGame.join(' · ')}</p>
      </section>
    </aside>
  )
}
