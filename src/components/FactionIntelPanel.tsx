import type { FactionIntel } from '../types/playerView'
import { KnowledgeScopeIcon } from './icons'

interface FactionIntelPanelProps {
  readonly faction: FactionIntel
}

export function FactionIntelPanel({ faction }: FactionIntelPanelProps) {
  return (
    <section aria-labelledby="faction-intel-heading">
      <h2 id="faction-intel-heading">Faction &amp; intel</h2>
      <p>
        {faction.factionName} — {faction.specialName} ({faction.specialRemainingUses} remaining)
      </p>
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
