import type { BoardPrivateProbability } from '../board/boardView'
import { probabilityLabel, revealedKnowledgeKey, revealedKnowledgeLabel } from '../knowledge/knowledgeLabels'
import type { DeclarationEntry, ExposeFactEntry, RevealedKnowledgeEntry } from '../knowledge/knowledgeView'
import { KnowledgeScopeIcon } from './icons'

export function KnowledgeScope({ scope }: { readonly scope: 'public' | 'private' }) {
  return <span className="knowledge-scope"><KnowledgeScopeIcon scope={scope} />{scope === 'private' ? 'Private intel' : 'Public intel'}</span>
}

function KnowledgeAge({ observedInRound, expiresAtEraEnd }: { readonly observedInRound: number; readonly expiresAtEraEnd: number }) {
  return <small>Observed round {observedInRound} · expires at the end of Era {expiresAtEraEnd}</small>
}

export function PrivateKnowledge({ entry }: { readonly entry: RevealedKnowledgeEntry }) {
  const { label, detail } = revealedKnowledgeLabel(entry)
  return (
    <span className="knowledge-card knowledge-private">
      <KnowledgeScope scope="private" />
      <strong>{label}</strong>
      {detail && <span>{detail}</span>}
      <KnowledgeAge observedInRound={entry.observedInRound} expiresAtEraEnd={entry.expiresAtEraEnd} />
    </span>
  )
}

export function EarnedKnowledge({ entries }: { readonly entries: readonly RevealedKnowledgeEntry[] }) {
  if (entries.length === 0) return null
  return (
    <section className="faction-knowledge">
      <h3 className="panel-eyebrow">Your earned knowledge</h3>
      <ul className="knowledge-list" aria-label="Your earned knowledge">
        {entries.map((entry) => <li key={revealedKnowledgeKey(entry)}><PrivateKnowledge entry={entry} /></li>)}
      </ul>
    </section>
  )
}

export function PrivateProbability({ entry }: { readonly entry: BoardPrivateProbability }) {
  return (
    <span className="knowledge-card knowledge-private">
      <KnowledgeScope scope="private" />
      <strong>Scan · {probabilityLabel(entry)}</strong>
      <KnowledgeAge observedInRound={entry.observedInRound} expiresAtEraEnd={entry.expiresAtEraEnd} />
    </span>
  )
}

export function DeclarationObservation({ entry }: { readonly entry: DeclarationEntry }) {
  return (
    <span className="knowledge-card knowledge-public">
      <KnowledgeScope scope="public" />
      <strong>{entry.playerName} · {entry.modeName}</strong>
      <span>{entry.eventTitle} → {entry.outcomeDescription}</span>
      <small>Era {entry.eraNumber}</small>
    </span>
  )
}

export function ExposeObservation({ entry }: { readonly entry: ExposeFactEntry }) {
  return (
    <span className="knowledge-card knowledge-public">
      <KnowledgeScope scope="public" />
      <strong>{entry.activistPlayerName} exposed {entry.targetPlayerName}</strong>
      {entry.signatureCardName && <span>{entry.signatureCardName}{entry.signatureEventTitle ? ` · ${entry.signatureEventTitle}` : ''}</span>}
      <small>Round {entry.roundNumber}</small>
      {entry.roundNumber === 3 && <span>{entry.behaviorChanged ? 'Behavior changed in Round 3' : 'Behavior unchanged in Round 3'}</span>}
    </span>
  )
}
