import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProblemError } from './client'
import { createLobby, getLobby, joinLobby, leaveLobby, lobbyErrorMessage, startGame } from './session'
import { uuid } from '../test/uuid'

const apiBaseUrl = 'https://api.example.test'
const lobbyId = uuid('lobby-1')
const gameId = uuid('game-1')
const hostId = uuid('player-1')

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('session API', () => {
  it('creates a lobby with the player name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { lobbyId, hostPlayerId: hostId, joinCode: 'JOIN-1' }))

    const result = await createLobby(fetchMock, apiBaseUrl, ' host-one ')

    expect(result).toEqual({ lobbyId, hostPlayerId: hostId, joinCode: 'JOIN-1' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.test/api/v1/lobbies')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ playerName: 'host-one' })
  })

  it('asks for every read past the browser cache, so polling always reaches the server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { lobbyId, gameId, hostPlayerId: hostId, status: 'WAITING', members: [] }),
    )

    await getLobby(fetchMock, apiBaseUrl, lobbyId)

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', cache: 'no-store' })
  })

  it('refuses a player name the contract does not accept before sending it', async () => {
    const fetchMock = vi.fn()

    await expect(createLobby(fetchMock, apiBaseUrl, '   ')).rejects.toThrow(/enter a player name/i)
    await expect(joinLobby(fetchMock, apiBaseUrl, lobbyId, 'x'.repeat(33))).rejects.toThrow(/at most 32 characters/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('recovers lobby membership, host and start state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        lobbyId,
        gameId,
        hostPlayerId: hostId,
        currentPlayerId: hostId,
        status: 'WAITING',
        members: [{ playerId: hostId, playerName: 'host-one', isHost: true }],
      }),
    )

    const view = await getLobby(fetchMock, apiBaseUrl, lobbyId)

    expect(view.status).toBe('WAITING')
    expect(view.gameId).toBe(gameId)
    expect(view.members).toHaveLength(1)
    expect(view.currentPlayerId).toBe(hostId)
  })

  it('rejects a lobby response that breaks the contract instead of showing it', async () => {
    const cases: unknown[] = [
      { lobbyId, gameId, hostPlayerId: hostId, status: 'PAUSED', members: [] },
      { lobbyId, gameId, hostPlayerId: hostId, status: 'WAITING' },
      { lobbyId: 'not-a-uuid', gameId, hostPlayerId: hostId, status: 'WAITING', members: [] },
    ]
    for (const body of cases) {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, body))

      await expect(getLobby(fetchMock, apiBaseUrl, lobbyId)).rejects.toThrow(/could not refresh the lobby: the game server's answer does not match its contract/i)
    }
  })

  it('rejects a caller identity that is not a lobby member', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        lobbyId,
        gameId,
        hostPlayerId: hostId,
        currentPlayerId: uuid('someone-else'),
        status: 'WAITING',
        members: [{ playerId: hostId, playerName: 'host-one', isHost: true }],
      }),
    )

    await expect(getLobby(fetchMock, apiBaseUrl, lobbyId)).rejects.toThrow(/not a lobby member/i)
  })

  it('surfaces stable problem codes for invalid invitations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { code: '404-01', detail: 'no lobby' }))

    const failure = await joinLobby(fetchMock, apiBaseUrl, uuid('missing'), 'guest').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ApiProblemError)
    expect((failure as ApiProblemError).code).toBe('404-01')
    expect(lobbyErrorMessage(failure)).toMatch(/not found/i)
  })

  it('keeps the start blockers a 409-03 names', async () => {
    const blockers = [uuid('p-1'), uuid('p-2')]
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(409, { code: '409-03', detail: 'disconnected', disconnectedPlayerIds: blockers }),
    )

    const failure = await startGame(fetchMock, apiBaseUrl, lobbyId).catch((error: unknown) => error)

    expect((failure as ApiProblemError).disconnectedPlayerIds).toEqual(blockers)
    expect(lobbyErrorMessage(failure)).toMatch(/2 players are disconnected/i)
  })

  it('reports full, started and permission denials without inventing state', async () => {
    const cases: Array<[unknown, RegExp]> = [
      [new ApiProblemError(422, '422-01', 'full'), /full/i],
      [new ApiProblemError(409, '409-01', 'started'), /already started/i],
      [new ApiProblemError(403, '403-02', 'not host'), /only the .*host/i],
      [new ApiProblemError(422, '422-02', 'too few'), /3 to 5/i],
      [new ApiProblemError(403, '403-01', 'not member'), /not a member/i],
      [new ApiProblemError(409, '409-03', 'disconnected', ['p-1', 'p-2']), /2 players.*disconnected/i],
      [new ApiProblemError(401, null, 'expired'), /session expired/i],
      [new ApiProblemError(418, '418-01', 'server detail'), /server detail/],
    ]
    for (const [error, pattern] of cases) {
      expect(lobbyErrorMessage(error)).toMatch(pattern)
    }
  })

  it('leaves without a body and starts as host', async () => {
    const leaveFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    await leaveLobby(leaveFetch, apiBaseUrl, lobbyId)
    expect(leaveFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE' })

    const startFetch = vi.fn().mockResolvedValue(jsonResponse(202, { gameId }))
    const started = await startGame(startFetch, apiBaseUrl, lobbyId)
    expect(started).toEqual({ gameId })
    expect(startFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' })
    expect(startFetch.mock.calls[0]?.[1]?.body).toBeUndefined()
    expect(new Headers(startFetch.mock.calls[0]?.[1]?.headers).get('Content-Type')).toBeNull()
  })

  it('reports unreachable servers as recoverable errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))

    await expect(getLobby(fetchMock, apiBaseUrl, lobbyId)).rejects.toThrow(/could not reach/i)
  })

  it('refuses a lobby reference the contract cannot address before sending it', async () => {
    const fetchMock = vi.fn()

    await expect(getLobby(fetchMock, apiBaseUrl, 'lobby-1')).rejects.toThrow(/does not match the game server's contract/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
