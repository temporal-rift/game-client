import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuthenticatedFetch } from './authenticatedFetch'

describe('authenticatedFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a fresh SDK token as a Bearer credential', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    const authenticatedFetch = createAuthenticatedFetch(async () => 'fresh-token')
    await authenticatedFetch('https://api.example.test/api/v1/games')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer fresh-token')
  })

  it('replaces a caller-provided credential with the session token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    const authenticatedFetch = createAuthenticatedFetch(async () => 'fresh-token')
    await authenticatedFetch('https://api.example.test/api/v1/games', {
      headers: { Authorization: 'Bearer stale-token' },
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer fresh-token')
  })

  it('notifies on 401 so private state can be cleared and reauthenticated', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    vi.stubGlobal('fetch', fetchMock)
    const onUnauthorized = vi.fn()

    const authenticatedFetch = createAuthenticatedFetch(async () => 'stale-token')
    await authenticatedFetch('https://api.example.test/api/v1/games', { onUnauthorized })

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('clears and reports when the session cannot supply credentials', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const onUnauthorized = vi.fn()

    const authenticatedFetch = createAuthenticatedFetch(async () => {
      throw new Error('login_required')
    })

    await expect(
      authenticatedFetch('https://api.example.test/api/v1/games', { onUnauthorized }),
    ).rejects.toThrow(/sign in again/i)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
