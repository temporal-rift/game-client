import type { FactionIntel } from '../types/playerView'
import { FactionEmblem, KnowledgeScopeIcon } from './icons'

interface FactionIntelPanelProps {
  readonly faction: FactionIntel
}

export function FactionIntelPanel({ faction }: FactionIntelPanelProps) {
  return (
    <section aria-labelledby="faction-intel-heading">
      <h2 id="faction-intel-heading">Faction &amp; intel</h2>
      <div className="faction-heading-row">
        <FactionEmblem />
        <p className="faction-summary">
          <span className="faction-name">{faction.factionName}</span>
          <span className="faction-special">
            {faction.specialName} ({faction.specialRemainingUses} remaining)
          </span>
        </p>
      </div>
      <ul>
        {faction.knowledge.map((item) => (
          <li key={item.id}>
            <span className="knowledge-scope">
              <KnowledgeScopeIcon scope={item.scope} />
              <span>{item.scope === 'private' ? 'Private: ' : 'Public: '}</span>
            </span>
            <span>{item.label}</span>
            <p>{item.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
