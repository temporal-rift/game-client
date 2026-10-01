import type { BoardHeader, BoardPlayer, BoardView } from '../board/boardView'
import type { GameStateStatus } from '../game/useGameState'
import { formatCountdown, useDeadlineCountdown } from '../game/useDeadlineCountdown'
import type { HandSelectionSession } from '../hand/useHandSelection'
import type { IllustrationSkin } from '../illustrations/catalogData'
import { EventBoard } from './EventBoard'
import { FactionIntelPanel } from './FactionIntelPanel'
import { PrivateHand } from './PrivateHand'
import { RoundStatusPanel } from './RoundStatusPanel'
import { RiftMark } from './icons'

interface AppShellProps {
  /** Null until a participant state has been loaded for this game. */
  readonly view: BoardView | null
  readonly status: GameStateStatus
  readonly onRetry: () => void
  readonly handSelection?: HandSelectionSession
  readonly illustrationSkin?: IllustrationSkin
}

function LoadError({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }) {
  return (
    <p className="board-error" role="alert">
      {message}{' '}
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </p>
  )
}

function PhaseDeadline({ header }: { readonly header: BoardHeader }) {
  // Local expiry is display-only: the phase changes when the server reports it.
  const secondsRemaining = useDeadlineCountdown(header.deadline)
  return (
    <div className="deadline-block">
      <span>{header.phaseLabel}</span>
      {secondsRemaining !== null && <strong aria-label="Time remaining">{formatCountdown(secondsRemaining)}</strong>}
      <i aria-hidden="true" />
    </div>
  )
}

function seatLabel(player: BoardPlayer): string {
  const faction = player.factionName ?? 'Faction hidden'
  return player.isCurrentPlayer ? `You · ${faction}` : faction
}

export function AppShell({ view, status, onRetry, handSelection, illustrationSkin = 'board' }: AppShellProps) {
  const failure = status.kind === 'failed' || status.kind === 'stalled' ? status : null

  if (!view) {
    return (
      <section className="app-shell board-unavailable" aria-label="Game board">
        {failure ? <LoadError message={failure.message} onRetry={onRetry} /> : <p>Loading the game…</p>}
      </section>
    )
  }

  const { header } = view
  return (
    <div className="app-shell">
      <header className="game-header">
        <div className="brand-lockup">
          <RiftMark />
          <div>
            <h1>Temporal Rift</h1>
            <p>Multiplayer strategy</p>
          </div>
        </div>
        <div className="phase-pills" aria-label="Current game phase">
          <span>Era {header.eraNumber}</span>
          {header.round && (
            <span>
              Round {header.round.number} of {header.round.of}
            </span>
          )}
        </div>
        <PhaseDeadline header={header} />
      </header>
      {failure && <LoadError message={failure.message} onRetry={onRetry} />}

      <section className="player-strip" aria-label="Player scores">
        <ul>
          {view.players.map((player) => (
            <li key={player.playerId} className={player.isCurrentPlayer ? 'is-current-player' : undefined}>
              <span className="player-avatar" aria-hidden="true">{player.name.slice(0, 1)}</span>
              <span className="player-identity">
                <strong>{player.name}</strong>
                <small>{seatLabel(player)}</small>
              </span>
              <span className="player-score">
                <strong>{player.score}</strong>
                <small>Points</small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <main className="game-board-layout">
        <FactionIntelPanel faction={view.faction} illustrationSkin={illustrationSkin} />
        <EventBoard events={view.events} illustrationSkin={illustrationSkin} />
        <PrivateHand hand={view.hand} handSelection={handSelection} illustrationSkin={illustrationSkin} />
        <RoundStatusPanel roundStatus={view.roundStatus} />
      </main>
    </div>
  )
}
