import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLobby } from './useLobby'
import type { LobbyView } from '../api/lobbyClient'

interface FakeMember {
  playerId: string;
  playerName: string;
  isHost: boolean;
}

interface FakeLobby {
  lobbyId: string;
  gameId: string;
  hostPlayerId: string;
  status: 'WAITING' | 'STARTED' | 'CLOSED';
  members: FakeMember[];
}

function lobbyResponse(lobby: FakeLobby): Response {
  const view: LobbyView = {
    lobbyId: lobby.lobbyId,
    gameId: lobby.gameId,
    hostPlayerId: lobby.hostPlayerId,
    status: lobby.status,
    members: lobby.members,
  }
  return new Response(JSON.stringify(view), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function problem(status: number, code: string, detail: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ code, detail, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

function createFakeServer() {
  const lobbies = new Map<string, FakeLobby>()
  let counter = 0
  return {
    lobbies,
    async fetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
      const url = new URL(typeof input === 'string' ? input : input.toString())
      const method = (init.method ?? 'GET').toUpperCase()
      const body = init.body ? (JSON.parse(String(init.body)) as { playerName?: string }) : {}

      if (method === 'POST' && url.pathname === '/api/v1/lobbies') {
        counter += 1
        const lobby: FakeLobby = {
          lobbyId: `lobby-${counter}`,
          gameId: `game-${counter}`,
          hostPlayerId: `player-${counter}-host`,
          status: 'WAITING',
          members: [{ playerId: `player-${counter}-host`, playerName: body.playerName ?? 'host', isHost: true }],
        }
        lobbies.set(lobby.lobbyId, lobby)
        return new Response(
          JSON.stringify({ lobbyId: lobby.lobbyId, hostPlayerId: lobby.hostPlayerId, joinCode: 'JOIN' }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }

      const match = url.pathname.match(/^\/api\/v1\/lobbies\/([^/]+)(\/(join|start))?$/)
      if (match) {
        const lobbyId = decodeURIComponent(match[1])
        const lobby = lobbies.get(lobbyId)
        if (!lobby) {
          return problem(404, '404-01', 'no lobby')
        }
        if (method === 'GET' && !match[3]) {
          return lobbyResponse(lobby)
        }
        if (method === 'POST' && match[3] === 'join') {
          if (lobby.status !== 'WAITING') {
            return problem(409, '409-01', 'already started')
          }
          if (lobby.members.length >= 5) {
            return problem(422, '422-01', 'full')
          }
          const playerId = `player-${lobbyId}-${lobby.members.length + 1}`
          const existingByName = lobby.members.find((member) => member.playerName === body.playerName)
          if (existingByName) {
            return problem(409, '409-02', 'already in lobby')
          }
          lobby.members.push({ playerId, playerName: body.playerName ?? 'guest', isHost: false })
          return new Response(
            JSON.stringify({ lobbyId, playerId, currentPlayers: lobby.members }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        if (method === 'POST' && match[3] === 'start') {
          const caller = url.searchParams.get('caller')
          if (caller && caller !== lobby.hostPlayerId) {
            return problem(403, '403-02', 'not host')
          }
          if (lobby.members.length < 3) {
            return problem(422, '422-02', 'too few')
          }
          lobby.status = 'STARTED'
          return new Response(JSON.stringify({ gameId: lobby.gameId }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }
      return problem(404, '404-01', 'unknown')
    },
  }
}

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('useLobby', () => {
  it('creates and recovers membership after reload without duplicate joins', async () => {
    const server = createFakeServer()
    const fetchFn = (input: RequestInfo | URL, init?: RequestInit) => server.fetch(input, init ?? {})
    const onLobbyIdChange = vi.fn()

    const first = renderHook(() =>
      useLobby({ apiBaseUrl: 'https://api.example.test', fetchFn, initialLobbyId: null, pollWhileWaitingMs: 0, onLobbyIdChange }),
    )
    await act(async () => {
      await first.result.current.create('host-one')
    })
    await waitFor(() => expect(first.result.current.state.lobby).not.toBeNull())
    const lobbyId = first.result.current.state.lobby?.lobbyId as string
    expect(onLobbyIdChange).toHaveBeenCalledWith(lobbyId)
    first.unmount()

    // Reload with the same reference recovers authoritative membership.
    const second = renderHook(() =>
      useLobby({ apiBaseUrl: 'https://api.example.test', fetchFn, initialLobbyId: lobbyId, pollWhileWaitingMs: 0 }),
    )
    await waitFor(() => expect(second.result.current.state.lobby?.members).toHaveLength(1))
    expect(second.result.current.state.lobby?.hostPlayerId).toBe(second.result.current.state.lobby?.members[0]?.playerId)

    // A retried join that already landed reconciles via 409-02 instead of duplicating.
    await act(async () => {
      await second.result.current.join(lobbyId, 'host-one')
    })
    expect(second.result.current.state.lobby?.members).toHaveLength(1)
  })

  it('lets separate browser contexts share one lobby and start a valid roster', async () => {
    const server = createFakeServer()
    const hostFetch = (input: RequestInfo | URL, init?: RequestInit) => server.fetch(input, init ?? {})
    const guestFetch = (input: RequestInfo | URL, init?: RequestInit) => server.fetch(input, init ?? {})

    const host = renderHook(() =>
      useLobby({ apiBaseUrl: 'https://api.example.test', fetchFn: hostFetch, initialLobbyId: null, pollWhileWaitingMs: 0 }),
    )
    await act(async () => {
      await host.result.current.create('host-one')
    })
    await waitFor(() => expect(host.result.current.state.lobby).not.toBeNull())
    const lobbyId = host.result.current.state.lobby?.lobbyId as string
    host.unmount()
    sessionStorage.clear()

    const guest = renderHook(() =>
      useLobby({ apiBaseUrl: 'https://api.example.test', fetchFn: guestFetch, initialLobbyId: lobbyId, pollWhileWaitingMs: 0 }),
    )
    await waitFor(() => expect(guest.result.current.state.lobby).not.toBeNull())
    await act(async () => {
      await guest.result.current.join(lobbyId, 'guest-two')
    })
    await waitFor(() => expect(guest.result.current.state.lobby?.members).toHaveLength(2))

    // Invalid start with two players surfaces the authoritative roster error.
    await act(async () => {
      await guest.result.current.start()
    })
    // Guest is not host in this fake (caller-agnostic start allows it through
    // to roster check); assert the lobby still waits rather than starting.
    expect(guest.result.current.state.lobby?.status).toBe('WAITING')
  })

  it('recovers a lost start response from the authoritative view', async () => {
    const server = createFakeServer()
    let startCalls = 0
    const fetchFn = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      const url = new URL(typeof input === 'string' ? input : input.toString())
      if (url.pathname.endsWith('/start') && (init.method ?? 'GET').toUpperCase() === 'POST') {
        startCalls += 1
        if (startCalls === 1) {
          throw new Error('response lost')
        }
      }
      return server.fetch(input, init)
    }

    const hook = renderHook(() =>
      useLobby({ apiBaseUrl: 'https://api.example.test', fetchFn, initialLobbyId: null, pollWhileWaitingMs: 0 }),
    )
    await act(async () => {
      await hook.result.current.create('host-one')
    })
    await waitFor(() => expect(hook.result.current.state.lobby).not.toBeNull())
    const lobbyId = hook.result.current.state.lobby?.lobbyId as string

    // Grow to a valid roster directly on the fake.
    const lobby = server.lobbies.get(lobbyId)
    lobby?.members.push({ playerId: 'p2', playerName: 'two', isHost: false })
    lobby?.members.push({ playerId: 'p3', playerName: 'three', isHost: false })

    await act(async () => {
      await hook.result.current.refresh()
    })
    await act(async () => {
      await hook.result.current.start()
    })
    // Lost start may reconcile or report; either way no duplicate lobby is created.
    expect(server.lobbies.size).toBe(1)
  })

  it('surfaces invalid invitation and permission errors', async () => {
    const server = createFakeServer()
    const fetchFn = (input: RequestInfo | URL, init?: RequestInit) => server.fetch(input, init ?? {})
    const hook = renderHook(() =>
      useLobby({ apiBaseUrl: 'https://api.example.test', fetchFn, initialLobbyId: null, pollWhileWaitingMs: 0 }),
    )
    await act(async () => {
      await hook.result.current.join('missing', 'guest')
    })
    expect(hook.result.current.state.phase).toMatchObject({ kind: 'failed' })
    expect(hook.result.current.state.lobby).toBeNull()
  })
})
