import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { Auth0Client } from '@auth0/auth0-spa-js'
import { usePlayerSession } from './usePlayerSession'
import type { AppConfig } from '../config/appConfig'

interface StubClient {
  getUser: () => Promise<{ sub?: string; preferred_username?: string } | undefined>
  handleRedirectCallback: () => Promise<{ appState?: unknown }>
  loginWithRedirect: (options?: unknown) => Promise<void>
  logout: (options?: unknown) => Promise<void>
  getTokenSilently: () => Promise<string>
}

const sdk = vi.hoisted(() => ({ client: null as StubClient | null }))

vi.mock('@auth0/auth0-spa-js', () => ({
  Auth0Client: vi.fn().mockImplementation(function MockAuth0Client(this: unknown) {
    if (!sdk.client) {
      throw new Error('stub Auth0 client is not configured')
    }
    return sdk.client
  }),
}))

const config: AppConfig = {
  apiBaseUrl: 'https://api.example.test',
  oidcIssuerUrl: 'https://issuer.example.test',
  oidcClientId: 'game-client',
  oidcAudience: 'https://api.example.test',
}

function stubClient(overrides: Partial<StubClient> = {}): StubClient {
  return {
    getUser: async () => undefined,
    handleRedirectCallback: async () => ({}),
    loginWithRedirect: async () => {},
    logout: async () => {},
    getTokenSilently: async () => 'token',
    ...overrides,
  }
}

describe('usePlayerSession with the Auth0 SDK', () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
    vi.mocked(Auth0Client).mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('completes a callback, restores the invitation and cleans the URL', async () => {
    sdk.client = stubClient({
      handleRedirectCallback: async () => ({ appState: { gameId: 'game-9' } }),
      getUser: async () => ({ sub: 'auth0|fresh', preferred_username: 'fresh' }),
    })
    window.history.replaceState(null, '', '/?code=code-a&state=state-a')

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('signed-in'))
    const status = result.current.status
    if (status.state === 'signed-in') {
      expect(status.session.identity.subject).toBe('auth0|fresh')
    }
    expect(window.location.search).toContain('game=game-9')
    expect(window.location.search).not.toContain('code=')
  })

  it('reports a denied login without fabricating a player', async () => {
    sdk.client = stubClient({
      handleRedirectCallback: async () => {
        throw { error: 'access_denied' }
      },
    })
    window.history.replaceState(null, '', '/?error=access_denied&state=state-b')

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('error'))
    const status = result.current.status
    if (status.state === 'error') {
      expect(status.message).toMatch(/denied/i)
    }
    expect(window.location.search).not.toContain('error=')
  })

  it('stays signed out when the SDK has no user', async () => {
    sdk.client = stubClient()

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('signed-out'))
  })

  it('signs out through the SDK and clears private caches', async () => {
    const logout = vi.fn(async () => {})
    sdk.client = stubClient({
      getUser: async () => ({ sub: 'auth0|one' }),
      logout,
    })
    sessionStorage.setItem('temporal-rift.private.hand', 'private')

    const { result } = renderHook(() => usePlayerSession(config))
    await waitFor(() => expect(result.current.status.state).toBe('signed-in'))

    await result.current.signOut()

    expect(logout).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('temporal-rift.private.hand')).toBeNull()
    await waitFor(() => expect(result.current.status.state).toBe('signed-out'))
  })

  it('recovers when silent token renewal fails', async () => {
    sdk.client = stubClient({
      getUser: async () => ({ sub: 'auth0|one' }),
      getTokenSilently: async () => {
        throw { error: 'login_required' }
      },
    })

    const { result } = renderHook(() => usePlayerSession(config))
    await waitFor(() => expect(result.current.status.state).toBe('signed-in'))

    await expect(result.current.getAccessToken()).resolves.toBeUndefined()
    await waitFor(() => expect(result.current.status.state).toBe('signed-out'))
    const status = result.current.status
    if (status.state === 'signed-out') {
      expect(status.reason).toMatch(/expired/i)
    }
  })
})
