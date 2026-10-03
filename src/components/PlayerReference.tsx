import { useId, useState } from 'react'
import { CARD_TYPES, FACTIONS, type Faction } from '../api/action'
import { cardDisplayName, cardEffectSummary, FACTION_SPECIALS, specialDisplayName, specialEffectSummary } from '../action/actionRules'
import { factionDisplayName } from '../board/boardView'
import { CARD_REFERENCE, FACTION_REFERENCE, SPECIAL_TIMING } from '../reference/playerReference'

export function PlayerReference({ faction = null }: { readonly faction?: Faction | null }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const panelId = useId()
  const query = search.trim().toLocaleLowerCase()
  const cards = CARD_TYPES.filter((type) => [cardDisplayName(type), cardEffectSummary(type), ...Object.values(CARD_REFERENCE[type])].join(' ').toLocaleLowerCase().includes(query))
  const factions = FACTIONS.filter((type) => [factionDisplayName(type), ...Object.values(FACTION_REFERENCE[type]), ...FACTION_SPECIALS[type].map((special) => `${specialDisplayName(special)} ${specialEffectSummary(special)} ${SPECIAL_TIMING[special]}`)].join(' ').toLocaleLowerCase().includes(query))

  return (
    <aside className="player-reference" aria-label="Player reference">
      <button type="button" className="reference-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        {open ? 'Close cards & factions' : 'Cards & factions'}
      </button>
      {open && (
        <section id={panelId} className="reference-panel" aria-label="Cards and factions reference">
          <h2>Learn the cards and factions</h2>
          <p>Keep this guide open while you choose. Your selection stays on the board.</p>
          <p>Each era: keep five of seven cards → optional Activist declaration → three action rounds → resolution. Each action round allows one card, one special, or a pass. A leading probability is a chance, not a guaranteed win.</p>
          <label className="reference-search">Search cards, factions or abilities
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          {search && <button type="button" onClick={() => setSearch('')}>Clear search</button>}
          <p role="status">{cards.length} cards · {factions.length} factions</p>
          {cards.length + factions.length === 0 && <p>No matching rules. Try a card, faction or ability name.</p>}
          <div className="reference-grid">
            {cards.map((type) => (
              <article className="reference-entry" key={type}>
                <h3>{cardDisplayName(type)}</h3>
                <p>{cardEffectSummary(type)}</p>
                <dl>
                  <dt>When and where</dt><dd>{CARD_REFERENCE[type].timing}</dd>
                  <dt>Grades</dt><dd>{CARD_REFERENCE[type].grades}</dd>
                  <dt>Example</dt><dd>{CARD_REFERENCE[type].example}</dd>
                </dl>
              </article>
            ))}
            {factions.map((type) => (
              <article className="reference-entry" key={type}>
                <h3>{factionDisplayName(type)}{type === faction ? ' · Your faction' : ''}</h3>
                <p>{FACTION_REFERENCE[type].goal}</p>
                <p>{FACTION_REFERENCE[type].scoring}</p>
                <dl>
                  {FACTION_SPECIALS[type].map((special) => (
                    <div key={special}><dt>{specialDisplayName(special)}</dt><dd>{specialEffectSummary(special)} {SPECIAL_TIMING[special]}</dd></div>
                  ))}
                  <dt>Example</dt><dd>{FACTION_REFERENCE[type].example}</dd>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}
