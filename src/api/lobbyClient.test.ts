import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LobbyApiError,
  createLobby,
  getGame,
  getLobby,
  joinLobby,
  leaveLobby,
  lobbyErrorMessage,
  startGame,
} from './lobbyClient'

const apiBaseUrl = 'https://api.example.test'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lobbyClient', () => {
  it('creates a lobby with the player name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, { lobbyId: 'lobby-1', hostPlayerId: 'player-1', joinCode: 'JOIN-1' }),
    )

    const result = await createLobby(fetchMock, apiBaseUrl, ' host-one ')

    expect(result).toEqual({ lobbyId: 'lobby-1', hostPlayerId: 'player-1', joinCode: 'JOIN-1' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.test/api/v1/lobbies')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ playerName: 'host-one' })
  })

  it('recovers lobby membership, host and start state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        lobbyId: 'lobby-1',
        gameId: 'game-1',
        hostPlayerId: 'player-1',
        currentPlayerId: 'player-1',
        status: 'WAITING',
        members: [{ playerId: 'player-1', playerName: 'host-one', isHost: true }],
      }),
    )

    const view = await getLobby(fetchMock, apiBaseUrl, 'lobby-1')

    expect(view.status).toBe('WAITING')
    expect(view.gameId).toBe('game-1')
    expect(view.members).toHaveLength(1)
    expect(view.currentPlayerId).toBe('player-1')
  })

  it('surfaces stable problem codes for invalid invitations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { code: '404-01', detail: 'no lobby' }))

    const failure = await joinLobby(fetchMock, apiBaseUrl, 'missing', 'guest').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(LobbyApiError)
    expect((failure as LobbyApiError).code).toBe('404-01')
    expect(lobbyErrorMessage(failure)).toMatch(/not found/i)
  })

  it('reports full, started and permission denials without inventing state', async () => {
    const cases: Array<[unknown, RegExp]> = [
      [new LobbyApiError(422, '422-01', 'full'), /full/i],
      [new LobbyApiError(409, '409-01', 'started'), /already started/i],
      [new LobbyApiError(403, '403-02', 'not host'), /only the .*host/i],
      [new LobbyApiError(422, '422-02', 'too few'), /3 to 5/i],
      [new LobbyApiError(403, '403-01', 'not member'), /not a member/i],
      [new LobbyApiError(409, '409-03', 'disconnected', ['p-1', 'p-2']), /2 players.*disconnected/i],
    ]
    for (const [error, pattern] of cases) {
      expect(lobbyErrorMessage(error)).toMatch(pattern)
    }
  })

  it('leaves without a body and starts as host', async () => {
    const leaveFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    await leaveLobby(leaveFetch, apiBaseUrl, 'lobby-1')
    expect(leaveFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE' })

    const startFetch = vi.fn().mockResolvedValue(jsonResponse(202, { gameId: 'game-1' }))
    const started = await startGame(startFetch, apiBaseUrl, 'lobby-1')
    expect(started).toEqual({ gameId: 'game-1' })
    expect(startFetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' })
    expect(startFetch.mock.calls[0]?.[1]?.body).toBeUndefined()
    expect(new Headers(startFetch.mock.calls[0]?.[1]?.headers).get('Content-Type')).toBeNull()
  })

  it('reads the public game summary after start', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        gameId: 'game-1',
        status: 'IN_PROGRESS',
        eraNumber: 1,
        playerCount: 3,
        cascadedParadoxCount: 0,
      }),
    )

    const summary = await getGame(fetchMock, apiBaseUrl, 'game-1')
    expect(summary.playerCount).toBe(3)
  })

  it('reports unreachable servers as recoverable errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))

    await expect(getLobby(fetchMock, apiBaseUrl, 'lobby-1')).rejects.toThrow(/could not reach/i)
  })
})
