import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProblemError } from './client'
import { getScores, getScoresHistory, scoresErrorMessage } from './scoring'
import { uuid } from '../test/uuid'

const apiBaseUrl = 'https://api.example.test'
const gameId = uuid('game-1')
const nora = uuid('p-1')
const eli = uuid('p-2')

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('scoring API', () => {
  it('reads participant-scoped current scores with hidden factions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        gameId,
        eraNumber: 2,
        scores: [
          { playerId: nora, playerName: 'Nora', score: 12 },
          { playerId: eli, playerName: 'Eli', score: 8 },
        ],
      }),
    )

    const view = await getScores(fetchMock, apiBaseUrl, gameId)

    expect(view.gameId).toBe(gameId)
    expect(view.scores).toHaveLength(2)
    expect(view.scores[0]).toEqual({ playerId: nora, playerName: 'Nora', score: 12 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://api.example.test/api/v1/games/${gameId}/scores`)
    expect(init.method).toBe('GET')
  })

  it('rejects a faction outside the contract instead of showing it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { gameId, eraNumber: 2, scores: [{ playerId: nora, playerName: 'Nora', score: 12, faction: 'PIRATES' }] }),
    )

    await expect(getScores(fetchMock, apiBaseUrl, gameId)).rejects.toThrow(/does not match its contract/i)
  })

  it('reads score history with entitled reasons only', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        gameId,
        history: [
          {
            eraNumber: 1,
            deltas: [
              { playerId: nora, pointsDelta: 4, reason: 'EVENT_RESOLVED_AS_WRITTEN' },
              { playerId: eli, pointsDelta: -2 },
            ],
          },
        ],
      }),
    )

    const view = await getScoresHistory(fetchMock, apiBaseUrl, gameId)

    expect(view.history).toHaveLength(1)
    expect(view.history[0]?.deltas[0]?.reason).toBe('EVENT_RESOLVED_AS_WRITTEN')
    expect(view.history[0]?.deltas[1]?.reason).toBeUndefined()
  })

  it('rejects without a network call when the game reference is blank', async () => {
    const fetchMock = vi.fn()

    await expect(getScores(fetchMock, apiBaseUrl, '  ')).rejects.toThrow(/game reference/i)
    await expect(getScoresHistory(fetchMock, apiBaseUrl, '')).rejects.toThrow(/game reference/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('carries the stable problem code for a non-participant read', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { code: '404-01', detail: 'no game' }))

    const failure = await getScores(fetchMock, apiBaseUrl, uuid('missing')).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ApiProblemError)
    expect((failure as ApiProblemError).code).toBe('404-01')
    expect(scoresErrorMessage(failure)).toMatch(/not a participant/i)
  })

  it('wraps a network failure in a retryable message and propagates cancellation', async () => {
    const network = vi.fn().mockRejectedValue(new TypeError('network down'))
    await expect(getScores(network, apiBaseUrl, gameId)).rejects.toThrow(/could not reach/i)

    const abortError = new DOMException('aborted', 'AbortError')
    const aborted = vi.fn().mockRejectedValue(abortError)
    await expect(getScoresHistory(aborted, apiBaseUrl, gameId)).rejects.toBe(abortError)
  })
})
