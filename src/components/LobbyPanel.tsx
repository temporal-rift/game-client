import { useMemo, useState } from 'react'
import { buildLobbyInvitationUrl, parseLobbyInvitation } from '../auth/invitation'
import type { LobbyView } from '../api/lobbyClient'
import type { LobbyPhase, LobbySession } from '../lobby/useLobby'

interface LobbyPanelProps {
  readonly lobby: LobbySession;
  readonly defaultPlayerName: string;
}

type FailedPhase = Extract<LobbyPhase, { kind: 'failed' }>

function invitationFromInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  // Accept a pasted invitation URL or a bare lobby reference.
  try {
    const url = new URL(trimmed)
    const parsed = parseLobbyInvitation(url.search)
    if (parsed) {
      return parsed.lobbyId
    }
  } catch {
    // Not a URL; fall through to bare-reference handling below.
  }
  const parsed = parseLobbyInvitation(`?game=${trimmed}`)
  return parsed?.lobbyId ?? null
}

function actionLabel(
  phase: LobbyPhase,
  action: 'creating' | 'joining' | 'starting',
  activeLabel: string,
  idleLabel: string,
): string {
  return phase.kind === 'working' && phase.action === action ? activeLabel : idleLabel
}

function FailureNotice({ failure, onDismiss }: { readonly failure: FailedPhase; readonly onDismiss: () => void }) {
  return (
    <p role="alert">
      {failure.message}
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </p>
  )
}

interface LobbyJoinViewProps {
  readonly lobby: LobbySession;
  readonly defaultPlayerName: string;
  readonly isWorking: boolean;
  readonly failure: FailedPhase | null;
}

function LobbyJoinView({ lobby, defaultPlayerName, isWorking, failure }: LobbyJoinViewProps) {
  const { state } = lobby
  const [createName, setCreateName] = useState(defaultPlayerName)
  const [joinName, setJoinName] = useState(defaultPlayerName)
  const [joinInput, setJoinInput] = useState('')

  const invitedLobbyId = useMemo(() => parseLobbyInvitation(window.location.search)?.lobbyId ?? null, [])

  return (
    <section aria-label="Game lobby">
      <h2>Game lobby</h2>
      {invitedLobbyId && <output>You were invited to lobby {invitedLobbyId}. Join below to take your seat.</output>}
      {failure && <FailureNotice failure={failure} onDismiss={lobby.dismissError} />}
      <div>
        <h3>Create a game</h3>
        <label>
          <span>Player name</span>
          <input
            aria-label="Player name for creating"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            maxLength={64}
          />
        </label>
        <button type="button" disabled={isWorking || !createName.trim()} onClick={() => void lobby.create(createName)}>
          {actionLabel(state.phase, 'creating', 'Creating…', 'Create game')}
        </button>
      </div>
      <div>
        <h3>Join a game</h3>
        <label>
          <span>Invitation link or lobby reference</span>
          <input
            aria-label="Invitation link or lobby reference"
            value={joinInput}
            placeholder={invitedLobbyId ?? 'Paste invitation link'}
            onChange={(event) => setJoinInput(event.target.value)}
          />
        </label>
        <label>
          <span>Player name</span>
          <input
            aria-label="Player name for joining"
            value={joinName}
            onChange={(event) => setJoinName(event.target.value)}
            maxLength={64}
          />
        </label>
        <button
          type="button"
          disabled={isWorking || !joinName.trim()}
          onClick={() => {
            const target = joinInput.trim() ? (invitationFromInput(joinInput) ?? joinInput.trim()) : invitedLobbyId
            if (target) {
              void lobby.join(target, joinName)
            }
          }}
        >
          {actionLabel(state.phase, 'joining', 'Joining…', 'Join game')}
        </button>
      </div>
    </section>
  )
}

interface WaitingControlsProps {
  readonly lobby: LobbySession;
  readonly view: LobbyView;
  readonly isWorking: boolean;
}

function WaitingControls({ lobby, view, isWorking }: WaitingControlsProps) {
  const { state } = lobby
  return (
    <div>
      {state.isHost ? (
        <>
          <button
            type="button"
            disabled={isWorking || !state.canStart}
            onClick={() => void lobby.start()}
            title={view.members.length < 3 || view.members.length > 5 ? 'Starting needs 3 to 5 players' : 'Start the game'}
          >
            {actionLabel(state.phase, 'starting', 'Starting…', 'Start game')}
          </button>
          {!state.canStart && <p>Starting needs 3 to 5 players. Invite more players before starting.</p>}
        </>
      ) : (
        <p>Only the lobby host can start the game.</p>
      )}
      <button type="button" disabled={isWorking} onClick={() => void lobby.refresh()}>
        Refresh membership
      </button>
      <button type="button" disabled={isWorking} onClick={() => void lobby.leave()}>
        Leave lobby
      </button>
    </div>
  )
}

interface LobbyMemberViewProps {
  readonly lobby: LobbySession;
  readonly view: LobbyView;
  readonly isWorking: boolean;
  readonly failure: FailedPhase | null;
}

function LobbyMemberView({ lobby, view, isWorking, failure }: LobbyMemberViewProps) {
  const { state } = lobby
  const [copied, setCopied] = useState(false)

  const invitationUrl = useMemo(() => {
    try {
      return buildLobbyInvitationUrl(window.location.origin, view.lobbyId)
    } catch {
      return null
    }
  }, [view.lobbyId])

  async function copyInvitation(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section aria-label="Game lobby">
      <h2>Game lobby</h2>
      {failure && <FailureNotice failure={failure} onDismiss={lobby.dismissError} />}
      <dl>
        <div>
          <dt>Lobby</dt>
          <dd>{view.lobbyId}</dd>
        </div>
        <div>
          <dt>Game</dt>
          <dd>{view.gameId}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{view.status}</dd>
        </div>
        <div>
          <dt>Players</dt>
          <dd>
            {view.members.length} of 5{view.members.length < 3 ? ' · needs 3 to start' : ''}
          </dd>
        </div>
      </dl>
      {invitationUrl && (
        <div>
          <p>Share this invitation; it carries only the lobby reference, never credentials.</p>
          <code>{invitationUrl}</code>{' '}
          <button type="button" onClick={() => void copyInvitation(invitationUrl)}>
            {copied ? 'Copied' : 'Copy invitation'}
          </button>
        </div>
      )}
      <ul aria-label="Lobby members">
        {view.members.map((member) => (
          <li key={member.playerId}>
            <strong>{member.playerName}</strong>{' '}
            {member.isHost && <span>Host</span>}{' '}
            {state.ownPlayerId === member.playerId && <span>You</span>}
          </li>
        ))}
      </ul>
      {view.status === 'WAITING' && <WaitingControls lobby={lobby} view={view} isWorking={isWorking} />}
      {view.status === 'STARTED' && (
        <div>
          <output>Game started. Game identity: {state.lastGameId ?? view.gameId}</output>
          <button type="button" disabled={isWorking} onClick={() => void lobby.refresh()}>
            Refresh membership
          </button>
          <button type="button" disabled={isWorking} onClick={() => void lobby.leave()}>
            Leave lobby
          </button>
        </div>
      )}
      {view.status === 'CLOSED' && (
        <div>
          <output>This lobby was closed.</output>
          <button type="button" disabled={isWorking} onClick={() => void lobby.leave()}>
            Leave lobby
          </button>
        </div>
      )}
    </section>
  )
}

export function LobbyPanel({ lobby, defaultPlayerName }: LobbyPanelProps) {
  const { state } = lobby
  const isWorking = state.phase.kind === 'working'
  const failure = state.phase.kind === 'failed' ? state.phase : null

  if (!state.lobby) {
    return <LobbyJoinView lobby={lobby} defaultPlayerName={defaultPlayerName} isWorking={isWorking} failure={failure} />
  }

  return <LobbyMemberView lobby={lobby} view={state.lobby} isWorking={isWorking} failure={failure} />
}
