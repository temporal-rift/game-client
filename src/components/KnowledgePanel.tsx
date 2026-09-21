import type { KnowledgeView, RevealedKnowledgeEntry } from '../knowledge/knowledgeView'
import { BandLabel } from './BandLabel'
import { KnowledgeScopeIcon } from './icons'

interface KnowledgePanelProps {
  readonly view: KnowledgeView
  readonly error: string | null
  readonly isRefreshing: boolean
  readonly onRefresh: () => void
}

/** A stable identity per entry — none of these carry a server-issued id, but each kind names its own subject. */
function revealedKnowledgeKey(entry: RevealedKnowledgeEntry): string {
  switch (entry.kind) {
    case 'PROBABILITY':
    case 'INFLUENCE':
      return `${entry.kind}-${entry.eventId}`
    case 'HAND_CARD':
      return `${entry.kind}-${entry.targetPlayerId}-${entry.observedInRound}`
  }
}

function revealedKnowledgeLabel(entry: RevealedKnowledgeEntry): { readonly label: string; readonly detail: string } {
  switch (entry.kind) {
    case 'PROBABILITY':
      return {
        label: `Scan · ${entry.eventTitle}`,
        detail:
          entry.outcomes.length > 0
            ? entry.outcomes
                .map(
                  (outcome) =>
                    `${outcome.outcomeDescription}: ${outcome.probability}%${outcome.isAnnihilated ? ' (annihilated)' : ''}${outcome.isSealed ? ' (sealed)' : ''}`,
                )
                .join(' · ')
            : 'No exact probabilities recorded.',
      }
    case 'INFLUENCE':
      return {
        label: `Trace · ${entry.eventTitle}`,
        detail: entry.influencerNames.length > 0 ? `Influenced by ${entry.influencerNames.join(', ')}` : 'No player influenced this event.',
      }
    case 'HAND_CARD':
      return {
        label: `Intercept · ${entry.targetPlayerName}`,
        detail:
          entry.revealedCards.length > 0
            ? entry.revealedCards.map((card) => `${card.cardName} · Grade ${card.grade}`).join(' · ')
            : 'No card was revealed.',
      }
  }
}

/**
 * Renders the participant's entitled knowledge: public bands and
 * already-broadcast declaration/Expose facts alongside the caller's own
 * earned exact knowledge, each carrying its own scope, observed age and
 * (for earned knowledge) era-end expiry so neither is mistaken for the
 * other. Bands only ever show Low/Medium/High/Unknown — never a number —
 * and every list shows exactly what the server published, nothing more.
 */
export function KnowledgePanel({ view, error, isRefreshing, onRefresh }: KnowledgePanelProps) {
  if (view.kind === 'unavailable') {
    return (
      <section aria-label="Observations and knowledge">
        <h2>Observations and knowledge</h2>
        <p>{view.reason}</p>
        {error && (
          <p role="alert">
            {error} <button type="button" onClick={onRefresh} disabled={isRefreshing}>Retry</button>
          </p>
        )}
      </section>
    )
  }

  return (
    <section aria-label="Observations and knowledge">
      <h2>Observations and knowledge</h2>

      <h3>Public bands</h3>
      {view.bands.length === 0 ? (
        <p>No public bands have been published yet this era.</p>
      ) : (
        <ul aria-label="Public bands">
          {view.bands.map((event) => (
            <li key={event.eventId}>
              <strong>{event.eventTitle}</strong>
              <span> · observed round {event.observedInRound}</span>
              <ul aria-label={`${event.eventTitle} bands`}>
                {event.outcomes.map((outcome) => (
                  <li key={outcome.outcomeId}>
                    <span>{outcome.outcomeDescription}</span>
                    <BandLabel band={outcome.band} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <h3>Your earned knowledge</h3>
      {view.revealedKnowledge.length === 0 ? (
        <p>You have not bought any intel this era.</p>
      ) : (
        <ul className="knowledge-list" aria-label="Your earned knowledge">
          {view.revealedKnowledge.map((entry) => {
            const { label, detail } = revealedKnowledgeLabel(entry)
            return (
              <li key={revealedKnowledgeKey(entry)} className="knowledge-card knowledge-private">
                <span className="knowledge-scope">
                  <KnowledgeScopeIcon scope="private" />
                  Private intel
                </span>
                <strong>{label}</strong>
                <span>{detail}</span>
                <small>
                  Observed round {entry.observedInRound} · expires at the end of Era {entry.expiresAtEraEnd}
                </small>
              </li>
            )
          })}
        </ul>
      )}

      <h3>Public declarations</h3>
      {view.declarations.length === 0 ? (
        <p>No Rally or Momentum declarations have been recorded this era.</p>
      ) : (
        <ul className="knowledge-list" aria-label="Public declarations">
          {view.declarations.map((declaration) => (
            <li key={`${declaration.playerId}-${declaration.eraNumber}`} className="knowledge-card knowledge-public">
              <span className="knowledge-scope">
                <KnowledgeScopeIcon scope="public" />
                Public intel
              </span>
              <strong>
                {declaration.playerName} · {declaration.modeName}
              </strong>
              <span>
                {declaration.eventTitle} → {declaration.outcomeDescription}
              </span>
              <small>Era {declaration.eraNumber}</small>
            </li>
          ))}
        </ul>
      )}

      <h3>Expose facts</h3>
      {view.exposeFacts.length === 0 ? (
        <p>No Expose signatures have been revealed this era.</p>
      ) : (
        <ul className="knowledge-list" aria-label="Expose facts">
          {view.exposeFacts.map((fact) => (
            <li key={`${fact.activistPlayerId}-${fact.targetPlayerId}-${fact.roundNumber}`} className="knowledge-card knowledge-public">
              <span className="knowledge-scope">
                <KnowledgeScopeIcon scope="public" />
                Public intel
              </span>
              <strong>
                {fact.activistPlayerName} exposed {fact.targetPlayerName}
              </strong>
              <span>
                Round {fact.roundNumber}
                {fact.signatureCardName ? ` · ${fact.signatureCardName}` : ''}
                {fact.signatureEventTitle ? ` · ${fact.signatureEventTitle}` : ''}
              </span>
              <small>{fact.behaviorChanged ? 'Behavior changed in Round 3' : 'Behavior unchanged in Round 3'}</small>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert">
          {error} <button type="button" onClick={onRefresh} disabled={isRefreshing}>Retry</button>
        </p>
      )}
    </section>
  )
}
