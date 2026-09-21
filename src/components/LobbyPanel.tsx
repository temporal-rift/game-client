import { useMemo, useState } from 'react'
import { buildLobbyInvitationUrl, parseLobbyInvitation } from '../auth/invitation'
import type { LobbySession } from '../lobby/useLobby'

interface LobbyPanelProps {
  readonly lobby: LobbySession;
  readonly defaultPlayerName: string;
}

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

export function LobbyPanel({ lobby, defaultPlayerName }: LobbyPanelProps) {
  const { state } = lobby
  const [createName, setCreateName] = useState(defaultPlayerName)
  const [joinName, setJoinName] = useState(defaultPlayerName)
  const [joinInput, setJoinInput] = useState('')
  const [copied, setCopied] = useState(false)
  const isWorking = state.phase.kind === 'working'
  const failure = state.phase.kind === 'failed' ? state.phase : null

  const invitationUrl = useMemo(() => {
    if (!state.lobby) {
      return null
    }
    try {
      return buildLobbyInvitationUrl(window.location.origin, state.lobby.lobbyId)
    } catch {
      return null
    }
  }, [state.lobby])

  const invitedLobbyId = useMemo(() => parseLobbyInvitation(window.location.search)?.lobbyId ?? null, [])

  async function copyInvitation(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (!state.lobby) {
    return (
      <section aria-label="Game lobby">
        <h2>Game lobby</h2>
        {invitedLobbyId && <p role="status">You were invited to lobby {invitedLobbyId}. Join below to take your seat.</p>}
        {failure && (
          <p role="alert">
            {failure.message}
            <button type="button" onClick={lobby.dismissError}>
              Dismiss
            </button>
          </p>
        )}
        <div>
          <h3>Create a game</h3>
          <label>
            Player name
            <input
              aria-label="Player name for creating"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              maxLength={64}
            />
          </label>
          <button
            type="button"
            disabled={isWorking || !createName.trim()}
            onClick={() => void lobby.create(createName)}
          >
            {state.phase.kind === 'working' && state.phase.action === 'creating' ? 'Creating…' : 'Create game'}
          </button>
        </div>
        <div>
          <h3>Join a game</h3>
          <label>
            Invitation link or lobby reference
            <input
              aria-label="Invitation link or lobby reference"
              value={joinInput}
              placeholder={invitedLobbyId ?? 'Paste invitation link'}
              onChange={(event) => setJoinInput(event.target.value)}
            />
          </label>
          <label>
            Player name
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
            {state.phase.kind === 'working' && state.phase.action === 'joining' ? 'Joining…' : 'Join game'}
          </button>
        </div>
      </section>
    )
  }

  const view = state.lobby
  return (
    <section aria-label="Game lobby">
      <h2>Game lobby</h2>
      {failure && (
        <p role="alert">
          {failure.message}
          <button type="button" onClick={lobby.dismissError}>
            Dismiss
          </button>
        </p>
      )}
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
      {view.status === 'WAITING' && (
        <div>
          {state.isHost ? (
            <>
              <button
                type="button"
                disabled={isWorking}
                onClick={() => void lobby.start()}
                title={view.members.length < 3 || view.members.length > 5 ? 'Starting needs 3 to 5 players' : 'Start the game'}
              >
                {state.phase.kind === 'working' && state.phase.action === 'starting' ? 'Starting…' : 'Start game'}
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
      )}
      {view.status === 'STARTED' && (
        <div>
          <p role="status">Game started. Game identity: {state.lastGameId ?? view.gameId}</p>
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
          <p role="status">This lobby was closed.</p>
          <button type="button" disabled={isWorking} onClick={() => void lobby.leave()}>
            Leave lobby
          </button>
        </div>
      )}
    </section>
  )
}
