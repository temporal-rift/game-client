import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorizationHeader, createAuthenticatedFetch, verifySessionAtUserinfo } from './authenticatedFetch'
import type { AuthSession } from './session'

const session: AuthSession = {
  accessToken: 'session-access-token',
  idToken: 'id',
  expiresAtEpochMs: 9_999_999_999_999,
  identity: { subject: 'auth0|one', issuer: 'https://issuer.example.test', displayName: 'one' },
}

describe('authenticatedFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the session as a Bearer credential', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    const authenticatedFetch = createAuthenticatedFetch(session)
    await authenticatedFetch('https://api.example.test/api/v1/games')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer session-access-token')
    expect(authorizationHeader(session)).toBe('Bearer session-access-token')
  })

  it('notifies on 401 so private state can be cleared and reauthenticated', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    vi.stubGlobal('fetch', fetchMock)
    const onUnauthorized = vi.fn()

    const authenticatedFetch = createAuthenticatedFetch(session)
    await authenticatedFetch('https://api.example.test/api/v1/games', { onUnauthorized })

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('verifies sessions against userinfo with authenticated HTTP', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })

    const ok = await verifySessionAtUserinfo(
      'https://issuer.example.test/userinfo',
      session,
      fetchMock as unknown as typeof fetch,
    )

    expect(ok).toBe(true)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer session-access-token')
  })
})
