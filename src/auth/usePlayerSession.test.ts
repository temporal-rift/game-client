import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { UserManager } from 'oidc-client-ts'
import { usePlayerSession } from './usePlayerSession'
import type { AppConfig } from '../config/appConfig'

interface StubProfile {
  readonly sub?: string
  readonly preferred_username?: string
}

interface StubUser {
  readonly profile: StubProfile
  readonly access_token: string
  readonly expired?: boolean
  readonly state?: unknown
}

interface StubClient {
  getUser: () => Promise<StubUser | null>
  signinRedirectCallback: () => Promise<StubUser>
  signinRedirect: (options?: unknown) => Promise<void>
  signoutRedirect: (options?: unknown) => Promise<void>
  removeUser: () => Promise<void>
  signinSilent: () => Promise<StubUser | null>
}

const sdk = vi.hoisted(() => ({ client: null as StubClient | null }))

vi.mock('oidc-client-ts', () => ({
  UserManager: vi.fn().mockImplementation(function MockUserManager(this: unknown) {
    if (!sdk.client) {
      throw new Error('stub UserManager is not configured')
    }
    return sdk.client
  }),
  WebStorageStateStore: vi.fn(),
}))

const config: AppConfig = {
  apiBaseUrl: 'https://api.example.test',
  oidcIssuerUrl: 'https://issuer.example.test',
  oidcClientId: 'game-client',
  oidcAudience: 'https://api.example.test',
  illustrationSkin: 'board',
}

function stubUser(overrides: Partial<StubUser> = {}): StubUser {
  return { profile: { sub: 'sub' }, access_token: 'token', expired: false, ...overrides }
}

function stubClient(overrides: Partial<StubClient> = {}): StubClient {
  return {
    getUser: async () => null,
    signinRedirectCallback: async () => stubUser(),
    signinRedirect: async () => {},
    signoutRedirect: async () => {},
    removeUser: async () => {},
    signinSilent: async () => null,
    ...overrides,
  }
}

describe('usePlayerSession with the generic OIDC SDK', () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
    vi.mocked(UserManager).mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('completes the callback and returns to the page sign-in started from', async () => {
    sdk.client = stubClient({
      signinRedirectCallback: async () =>
        stubUser({ state: { returnTo: '/games/game-9' }, profile: { sub: 'fresh', preferred_username: 'fresh' } }),
    })
    window.history.replaceState(null, '', '/auth/callback?code=code-a&state=state-a')

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('signed-in'))
    const status = result.current.status
    if (status.state === 'signed-in') {
      expect(status.session.identity.subject).toBe('fresh')
    }
    expect(window.location.pathname).toBe('/games/game-9')
    expect(window.location.search).not.toContain('code=')
  })

  it('returns home instead of following an unsafe return path', async () => {
    sdk.client = stubClient({
      signinRedirectCallback: async () => stubUser({ state: { returnTo: '//evil.example/steal' } }),
    })
    window.history.replaceState(null, '', '/auth/callback?code=code-c&state=state-c')

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('signed-in'))
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('')
  })

  it('reports a denied login without fabricating a player', async () => {
    sdk.client = stubClient({
      signinRedirectCallback: async () => {
        throw { error: 'access_denied' }
      },
    })
    window.history.replaceState(null, '', '/auth/callback?error=access_denied&state=state-b')

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('error'))
    const status = result.current.status
    if (status.state === 'error') {
      expect(status.message).toMatch(/denied/i)
    }
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).not.toContain('error=')
  })

  it('only completes callbacks on the callback page', async () => {
    const signinRedirectCallback = vi.fn(async () => stubUser())
    sdk.client = stubClient({ signinRedirectCallback })
    window.history.replaceState(null, '', '/games/game-1?code=code-d&state=state-d')

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('signed-out'))
    expect(signinRedirectCallback).not.toHaveBeenCalled()
  })

  it('leaves a stray visit to the callback page for home', async () => {
    sdk.client = stubClient({ getUser: async () => stubUser({ profile: { sub: 'one' } }) })
    window.history.replaceState(null, '', '/auth/callback')

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('signed-in'))
    expect(window.location.pathname).toBe('/')
  })

  it('signs in carrying the current page as the return path', async () => {
    const signinRedirect = vi.fn(async () => {})
    sdk.client = stubClient({ signinRedirect })
    window.history.replaceState(null, '', '/lobbies/lobby-4')

    const { result } = renderHook(() => usePlayerSession(config))
    await waitFor(() => expect(result.current.status.state).toBe('signed-out'))

    await result.current.signIn()

    expect(signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/lobbies/lobby-4' } })
  })

  it('stays signed out when the SDK has no user', async () => {
    sdk.client = stubClient()

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('signed-out'))
  })

  it('signs out through the SDK (preserving its id_token_hint) and clears private caches', async () => {
    const signoutRedirect = vi.fn(async () => {})
    sdk.client = stubClient({
      getUser: async () => stubUser({ profile: { sub: 'one' } }),
      signoutRedirect,
    })
    sessionStorage.setItem('temporal-rift.private.hand', 'private')

    const { result } = renderHook(() => usePlayerSession(config))
    await waitFor(() => expect(result.current.status.state).toBe('signed-in'))

    await result.current.signOut()

    expect(signoutRedirect).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('temporal-rift.private.hand')).toBeNull()
    await waitFor(() => expect(result.current.status.state).toBe('signed-out'))
  })

  it('recovers when silent token renewal fails', async () => {
    sdk.client = stubClient({
      getUser: async () => stubUser({ profile: { sub: 'one' }, expired: true }),
      signinSilent: async () => {
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
