import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LobbyPanel } from './LobbyPanel'
import type { LobbySession } from '../lobby/useLobby'
import type { LobbyView } from '../api/lobbyClient'

function lobbyView(overrides: Partial<LobbyView> = {}): LobbyView {
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
    render(<LobbyPanel lobby={session()} defaultPlayerName="host-one" />)

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
    const { rerender } = render(<LobbyPanel lobby={guest} defaultPlayerName="guest-two" />)

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
    rerender(<LobbyPanel lobby={hostReady} defaultPlayerName="host-one" />)

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
    render(<LobbyPanel lobby={hostTooFew} defaultPlayerName="host-one" />)

    expect(screen.getByRole('button', { name: /start game/i })).toBeDisabled()
  })

  it('shows authoritative errors without fabricating membership', () => {
    const failed = session({
      phase: { kind: 'failed', message: 'This lobby is full (5 players maximum).', code: '422-01' },
      lobby: lobbyView(),
    })
    render(<LobbyPanel lobby={failed} defaultPlayerName="guest" />)

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
    window.history.replaceState(null, '', '/?game=lobby-9')
    render(<LobbyPanel lobby={idle} defaultPlayerName="player-one" />)

    expect(screen.getByText(/invited to lobby lobby-9/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /create game/i }))
    expect(create).toHaveBeenCalledWith('player-one')

    await userEvent.type(screen.getByLabelText(/invitation link or lobby reference/i), 'lobby-9')
    await userEvent.click(screen.getByRole('button', { name: /join game/i }))
    expect(join).toHaveBeenCalledWith('lobby-9', 'player-one')
    window.history.replaceState(null, '', '/')
  })

  it('announces the started game identity', () => {
    const started = session({
      lobby: lobbyView({ status: 'STARTED' }),
      lastGameId: 'game-1',
    })
    render(<LobbyPanel lobby={started} defaultPlayerName="host-one" />)

    expect(screen.getByRole('status')).toHaveTextContent(/game started/i)
    expect(screen.getAllByText(/game-1/).length).toBeGreaterThan(0)
  })
})
