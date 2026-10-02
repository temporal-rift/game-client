import type { SpecialAction } from '../api/action'
import type { SpecialActionOption } from '../action/actionView'
import type { BoardFaction, BoardSpecial } from '../board/boardView'
import { FactionIllustration } from '../illustrations/catalog'
import type { IllustrationSkin } from '../illustrations/catalogData'
import { FactionEmblem } from './icons'

/** Present only while the caller can choose an action this round. */
export interface SpecialActionControls {
  readonly selectedSpecial: SpecialAction | null
  /** The specials the open round offers, with their availability. */
  readonly options: readonly SpecialActionOption[]
  readonly disabled: boolean
  readonly onSelect: (specialAction: SpecialAction) => void
}

interface FactionIntelPanelProps {
  readonly faction: BoardFaction
  readonly illustrationSkin?: IllustrationSkin
  readonly action?: SpecialActionControls | null
}

function remainingUsesLabel({ remainingThisEra, remainingThisGame }: BoardSpecial): string | null {
  if (remainingThisEra === null && remainingThisGame === null) {
    return null
  }
  return `${remainingThisEra ?? '–'} this era · ${remainingThisGame ?? '–'} this game`
}

function SpecialContent({ special, reason }: { readonly special: BoardSpecial; readonly reason: string | null }) {
  const remaining = remainingUsesLabel(special)
  return (
    <>
      <strong>{special.name}</strong>
      {remaining && <span>{remaining}</span>}
      {reason && <span className="faction-special-reason">{reason}</span>}
    </>
  )
}

function SpecialItem({ special, action }: { readonly special: BoardSpecial; readonly action: SpecialActionControls | null }) {
  const option = action?.options.find((entry) => entry.specialAction === special.specialAction)
  if (!action || !option) {
    return (
      <li className="faction-special">
        <SpecialContent special={special} reason={null} />
      </li>
    )
  }
  const isSelected = action.selectedSpecial === special.specialAction
  return (
    <li>
      <button
        type="button"
        className={`faction-special${isSelected ? ' is-selected' : ''}`}
        aria-pressed={isSelected}
        disabled={action.disabled || !option.available}
        onClick={() => action.onSelect(special.specialAction)}
      >
        <SpecialContent special={special} reason={option.available ? null : option.unavailableReason} />
      </button>
    </li>
  )
}

export function FactionIntelPanel({ faction, illustrationSkin = 'board', action = null }: FactionIntelPanelProps) {
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
          <ul className="faction-specials" aria-label="Faction specials">
            {faction.specials.map((special) => (
              <SpecialItem key={special.specialAction} special={special} action={action} />
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}
