import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScoresApiError, getScores, getScoresHistory, scoresErrorMessage } from './scoresClient'

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

describe('scoresClient', () => {
  it('reads participant-scoped current scores with hidden factions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        gameId: 'game-1',
        eraNumber: 2,
        scores: [
          { playerId: 'p-1', playerName: 'Nora', score: 12, faction: null },
          { playerId: 'p-2', playerName: 'Eli', score: 8, faction: null },
        ],
      }),
    )

    const view = await getScores(fetchMock, apiBaseUrl, 'game-1')

    expect(view.gameId).toBe('game-1')
    expect(view.scores).toHaveLength(2)
    expect(view.scores[0]).toMatchObject({ playerId: 'p-1', score: 12, faction: null })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.test/api/v1/games/game-1/scores')
    expect(init.method).toBe('GET')
  })

  it('reads score history with entitled reasons only', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        gameId: 'game-1',
        history: [
          {
            eraNumber: 1,
            deltas: [
              { playerId: 'p-1', pointsDelta: 4, reason: 'EVENT_RESOLVED_AS_WRITTEN' },
              { playerId: 'p-2', pointsDelta: -2 },
            ],
          },
        ],
      }),
    )

    const view = await getScoresHistory(fetchMock, apiBaseUrl, 'game-1')

    expect(view.history).toHaveLength(1)
    expect(view.history[0]?.deltas[0]?.reason).toBe('EVENT_RESOLVED_AS_WRITTEN')
    expect(view.history[0]?.deltas[1]?.reason).toBeNull()
  })

  it('rejects without a network call when the game reference is blank', async () => {
    const fetchMock = vi.fn()

    await expect(getScores(fetchMock, apiBaseUrl, '  ')).rejects.toThrow(/game reference/i)
    await expect(getScoresHistory(fetchMock, apiBaseUrl, '')).rejects.toThrow(/game reference/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('carries the stable problem code for a non-participant read', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { code: '404-01', detail: 'no game' }))

    const failure = await getScores(fetchMock, apiBaseUrl, 'missing').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ScoresApiError)
    expect((failure as ScoresApiError).code).toBe('404-01')
    expect(scoresErrorMessage(failure)).toMatch(/not a participant/i)
  })

  it('wraps a network failure in a retryable message and propagates cancellation', async () => {
    const network = vi.fn().mockRejectedValue(new TypeError('network down'))
    await expect(getScores(network, apiBaseUrl, 'game-1')).rejects.toThrow(/could not reach/i)

    const abortError = new DOMException('aborted', 'AbortError')
    const aborted = vi.fn().mockRejectedValue(abortError)
    await expect(getScoresHistory(aborted, apiBaseUrl, 'game-1')).rejects.toBe(abortError)
  })
})
