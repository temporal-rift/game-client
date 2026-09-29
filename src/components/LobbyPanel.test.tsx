import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LobbyPanel } from './LobbyPanel'
import { renderInRouter } from '../test/renderInRouter'
import type { LobbySession } from '../lobby/useLobby'
import type { LobbyResponse } from '../api/session'

function lobbyView(overrides: Partial<LobbyResponse> = {}): LobbyResponse {
  return {
    lobbyId: 'lobby-1',
    gameId: 'game-1',
    hostPlayerId: 'player-1',
    status: 'WAITING',
    members: [
      { playerId: 'player-1', playerName: 'host-one', isHost: true },
      { playerId: 'player-2', playerName: 'guest-two', isHost: false },
    ],
    ...overrides,
  }
}

function session(overrides: Partial<LobbySession['state']> = {}, actions: Partial<LobbySession> = {}): LobbySession {
  return {
    state: {
      phase: { kind: 'ready' },
      lobby: lobbyView(),
      ownPlayerId: 'player-1',
      lastGameId: null,
      isHost: true,
      canStart: false,
      ...overrides,
    },
    create: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    start: vi.fn(),
    refresh: vi.fn(),
    dismissError: vi.fn(),
    ...actions,
  }
}

describe('LobbyPanel', () => {
  it('shows a shareable invitation with membership and host state after create', () => {
    render(<LobbyPanel lobby={session()} defaultPlayerName="host-one" invitedLobbyId={null} />)

    expect(screen.getByRole('region', { name: 'Game lobby' })).toBeInTheDocument()
    expect(screen.getAllByText(/lobby-1/).length).toBeGreaterThan(0)
    expect(screen.getByText('host-one')).toBeInTheDocument()
    expect(screen.getByText('Host')).toBeInTheDocument()
    expect(screen.getByText(/only the lobby reference/i)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/access_token/i)
  })

  it('gates start to the host and a valid three-to-five roster', async () => {
    const start = vi.fn()
    const guest = session(
      { lobby: lobbyView(), ownPlayerId: 'player-2', isHost: false, canStart: false },
      { start },
    )
    const { rerender } = render(<LobbyPanel lobby={guest} defaultPlayerName="guest-two" invitedLobbyId={null} />)

    expect(screen.getByText(/only the .*host can start/i)).toBeInTheDocument()

    const hostReady = session(
      {
        lobby: lobbyView({
          members: [
            { playerId: 'player-1', playerName: 'host-one', isHost: true },
            { playerId: 'player-2', playerName: 'guest-two', isHost: false },
            { playerId: 'player-3', playerName: 'guest-three', isHost: false },
          ],
        }),
        ownPlayerId: 'player-1',
        isHost: true,
        canStart: true,
      },
      { start },
    )
    rerender(<LobbyPanel lobby={hostReady} defaultPlayerName="host-one" invitedLobbyId={null} />)

    await userEvent.click(screen.getByRole('button', { name: /start game/i }))
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('disables start for the host when the roster is below three players', () => {
    const start = vi.fn()
    const hostTooFew = session(
      {
        lobby: lobbyView({ members: [{ playerId: 'player-1', playerName: 'host-one', isHost: true }] }),
        isHost: true,
        canStart: false,
      },
      { start },
    )
    render(<LobbyPanel lobby={hostTooFew} defaultPlayerName="host-one" invitedLobbyId={null} />)

    expect(screen.getByRole('button', { name: /start game/i })).toBeDisabled()
  })

  it('shows authoritative errors without fabricating membership', () => {
    const failed = session({
      phase: { kind: 'failed', message: 'This lobby is full (5 players maximum).', code: '422-01' },
      lobby: lobbyView(),
    })
    render(<LobbyPanel lobby={failed} defaultPlayerName="guest" invitedLobbyId={null} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/full.*5 players/i)
    expect(screen.getByText('host-one')).toBeInTheDocument()
  })

  it('creates and joins through explicit controls', async () => {
    const create = vi.fn()
    const join = vi.fn()
    const idle: LobbySession = {
      state: { phase: { kind: 'idle' }, lobby: null, ownPlayerId: null, lastGameId: null, isHost: false, canStart: false },
      create,
      join,
      leave: vi.fn(),
      start: vi.fn(),
      refresh: vi.fn(),
      dismissError: vi.fn(),
    }
    render(<LobbyPanel lobby={idle} defaultPlayerName="player-one" invitedLobbyId={null} />)

    await userEvent.click(screen.getByRole('button', { name: /create game/i }))
    expect(create).toHaveBeenCalledWith('player-one')

    expect(screen.getByRole('button', { name: /join game/i })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/invitation link or lobby reference/i), 'lobby-9')
    await userEvent.click(screen.getByRole('button', { name: /join game/i }))
    expect(join).toHaveBeenCalledWith('lobby-9', 'player-one')
  })

  it('starts every name input empty and gates create and join without a display name', async () => {
    const idle = session({ phase: { kind: 'idle' }, lobby: null, ownPlayerId: null, isHost: false })
    render(<LobbyPanel lobby={idle} defaultPlayerName="" invitedLobbyId={null} />)

    expect(screen.getByLabelText('Player name for creating')).toHaveValue('')
    expect(screen.getByLabelText('Player name for joining')).toHaveValue('')
    expect(screen.getByRole('button', { name: /create game/i })).toBeDisabled()

    await userEvent.type(screen.getByLabelText(/invitation link or lobby reference/i), 'lobby-9')
    expect(screen.getByRole('button', { name: /join game/i })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Player name for creating'), 'juanito')
    expect(screen.getByRole('button', { name: /create game/i })).toBeEnabled()
  })

  it('offers only a name and a join for the invited lobby to a non-member', async () => {
    const join = vi.fn()
    const idle = session({ phase: { kind: 'idle' }, lobby: null, ownPlayerId: null, isHost: false }, { join })
    await renderInRouter(<LobbyPanel lobby={idle} defaultPlayerName="juanito" invitedLobbyId="lobby-9" />)

    expect(screen.getByRole('region', { name: 'Lobby invitation' })).toHaveTextContent(/lobby-9/)
    expect(screen.queryByLabelText(/invitation link or lobby reference/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create game/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Player name')).toHaveValue('juanito')
    expect(screen.getByRole('link', { name: /different game/i })).toHaveAttribute('href', '/lobby')

    await userEvent.click(screen.getByRole('button', { name: /join game/i }))
    expect(join).toHaveBeenCalledWith('lobby-9', 'juanito')
  })

  it('keeps the invitation view and shows a rejected invitation join', async () => {
    const rejected = session({
      phase: { kind: 'failed', message: 'This lobby is full (5 players maximum).', code: '422-01' },
      lobby: null,
      ownPlayerId: null,
      isHost: false,
    })
    await renderInRouter(<LobbyPanel lobby={rejected} defaultPlayerName="" invitedLobbyId="lobby-9" />)

    expect(screen.getByRole('alert')).toHaveTextContent(/full.*5 players/i)
    expect(screen.getByRole('region', { name: 'Lobby invitation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /join game/i })).toBeDisabled()
  })

  it('shows a member their lobby instead of its invitation', () => {
    render(<LobbyPanel lobby={session()} defaultPlayerName="host-one" invitedLobbyId="lobby-1" />)

    expect(screen.getByRole('region', { name: 'Game lobby' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Lobby invitation' })).not.toBeInTheDocument()
  })

  it('announces the started game and links to its page', async () => {
    const started = session({
      lobby: lobbyView({ status: 'STARTED' }),
      lastGameId: 'game-1',
    })
    await renderInRouter(<LobbyPanel lobby={started} defaultPlayerName="host-one" invitedLobbyId={null} />)

    expect(screen.getByRole('status')).toHaveTextContent(/game started/i)
    expect(screen.getAllByText(/game-1/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Open game' })).toHaveAttribute('href', '/games/game-1')
  })

  it('joins the lobby named by a pasted invitation link', async () => {
    const join = vi.fn()
    const idle = session({ phase: { kind: 'idle' }, lobby: null, ownPlayerId: null, isHost: false }, { join })
    render(<LobbyPanel lobby={idle} defaultPlayerName="player-one" invitedLobbyId={null} />)

    await userEvent.type(
      screen.getByLabelText(/invitation link or lobby reference/i),
      'https://app.example.test/lobbies/lobby-7',
    )
    await userEvent.click(screen.getByRole('button', { name: /join game/i }))

    expect(join).toHaveBeenCalledWith('lobby-7', 'player-one')
  })
})
