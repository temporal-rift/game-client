import type { ActionCoordinates } from '../api/action'
import type { TargetMode } from '../action/actionRules'
import { isPlayerChosen, targetsPlayers } from '../action/actionTargeting'
import type { OpponentOption } from '../action/actionView'
import type { BoardPlayer } from '../board/boardView'
import { DeclarationObservation, ExposeObservation } from './BoardKnowledge'

/** Present only while the selected card or special targets players. */
export interface PlayerTargeting {
  readonly targetMode: TargetMode
  readonly coordinates: ActionCoordinates
  /** The opponents the open round offers as targets. */
  readonly opponents: readonly OpponentOption[]
  readonly disabled: boolean
  readonly onPickPlayer: (playerId: string) => void
}

interface PlayerStripProps {
  readonly players: readonly BoardPlayer[]
  readonly targeting?: PlayerTargeting | null
}

function seatLabel(player: BoardPlayer): string {
  const faction = player.factionName ?? 'Faction hidden'
  return player.isCurrentPlayer ? `You · ${faction}` : faction
}

function PlayerContent({ player, note }: { readonly player: BoardPlayer; readonly note: string | null }) {
  return (
    <>
      <span className="player-avatar" aria-hidden="true">
        {player.name.slice(0, 1)}
      </span>
      <span className="player-identity">
        <strong>{player.name}</strong>
        <small>{note ? `${seatLabel(player)} · ${note}` : seatLabel(player)}</small>
      </span>
      <span className="player-score">
        <strong>{player.score}</strong>
        <small>Points</small>
      </span>
    </>
  )
}

function targetNote(opponent: OpponentOption, isChosen: boolean): string | null {
  if (!opponent.isConnected) return 'Disconnected'
  return isChosen ? 'Selected target' : null
}

function PlayerObservations({ player }: { readonly player: BoardPlayer }) {
  if (player.declarations.length === 0 && player.exposeFacts.length === 0) return null
  return (
    <div className="player-observations">
      {player.declarations.map((entry) => <DeclarationObservation key={`${entry.playerId}-${entry.eraNumber}`} entry={entry} />)}
      {player.exposeFacts.map((entry) => <ExposeObservation key={`${entry.activistPlayerId}-${entry.targetPlayerId}-${entry.roundNumber}`} entry={entry} />)}
    </div>
  )
}

export function PlayerStrip({ players, targeting = null }: PlayerStripProps) {
  const activeTargeting = targeting && targetsPlayers(targeting.targetMode) ? targeting : null
  const list = (
    <ul aria-label={activeTargeting ? 'Players' : undefined}>
      {players.map((player) => {
        const opponent = activeTargeting?.opponents.find((entry) => entry.playerId === player.playerId)
        const className = player.isCurrentPlayer ? 'is-current-player' : undefined
        if (!activeTargeting || !opponent) {
          return (
            <li key={player.playerId} className={className}>
              <PlayerContent player={player} note={null} />
              <PlayerObservations player={player} />
            </li>
          )
        }
        const isChosen = isPlayerChosen(activeTargeting.targetMode, activeTargeting.coordinates, player.playerId)
        return (
          <li key={player.playerId} className={className}>
            <button
              type="button"
              className={`player-target${isChosen ? ' is-selected' : ''}`}
              aria-pressed={isChosen}
              disabled={activeTargeting.disabled || !opponent.isConnected}
              onClick={() => activeTargeting.onPickPlayer(player.playerId)}
            >
              <PlayerContent player={player} note={targetNote(opponent, isChosen)} />
            </button>
            <PlayerObservations player={player} />
          </li>
        )
      })}
    </ul>
  )
  return (
    <section className="player-strip" aria-label="Player scores">
      {activeTargeting ? (
        <fieldset className="target-group" aria-label="Choose a target">
          {list}
        </fieldset>
      ) : (
        list
      )}
    </section>
  )
}
