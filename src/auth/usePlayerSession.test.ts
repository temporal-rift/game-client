import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePlayerSession } from './usePlayerSession'
import { savePendingLogin, saveSession } from './session'
import type { AuthSession } from './session'
import type { AppConfig } from '../config/appConfig'

const config: AppConfig = {
  apiBaseUrl: 'https://api.example.test',
  oidcIssuerUrl: 'https://issuer.example.test',
  oidcClientId: 'game-client',
}

function idToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown): string => {
    let encoded = btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('_', '/')
    while (encoded.endsWith('=')) {
      encoded = encoded.slice(0, -1)
    }
    return encoded
  }
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.signature`
}

const storedSession: AuthSession = {
  accessToken: 'stored-access',
  idToken: 'stored-id',
  expiresAtEpochMs: Date.now() + 3_600_000,
  identity: { subject: 'auth0|stored', issuer: config.oidcIssuerUrl, displayName: 'stored' },
}

function mockOidcServer(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('.well-known/openid-configuration')) {
        return {
          ok: true,
          json: async () => ({
            issuer: config.oidcIssuerUrl,
            authorization_endpoint: `${config.oidcIssuerUrl}/authorize`,
            token_endpoint: `${config.oidcIssuerUrl}/token`,
          }),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'fresh-access',
          id_token: idToken({ sub: 'auth0|fresh', iss: config.oidcIssuerUrl }),
          expires_in: 300,
        }),
      }
    }),
  )
}

describe('usePlayerSession callback handling', () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('exchanges a matching callback, saves the session and cleans the URL', async () => {
    mockOidcServer()
    savePendingLogin({
      codeVerifier: 'verifier',
      state: 'good-state',
      redirectUri: 'http://localhost/',
      invitationGameId: 'game-9',
    })
    window.history.replaceState(null, '', '/?code=auth-code&state=good-state')

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('signed-in'))
    const status = result.current.status
    if (status.state === 'signed-in') {
      expect(status.session.identity.subject).toBe('auth0|fresh')
    }
    expect(window.location.search).toContain('game=game-9')
    expect(window.location.search).not.toContain('code=')
    expect(window.location.search).not.toContain('state=good-state')
  })

  it('preserves the signed-in session when the callback state does not match', async () => {
    mockOidcServer()
    saveSession(storedSession)
    savePendingLogin({
      codeVerifier: 'verifier',
      state: 'expected-state',
      redirectUri: 'http://localhost/',
      invitationGameId: null,
    })
    window.history.replaceState(null, '', '/?code=auth-code&state=wrong-state')

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('signed-in'))
    const status = result.current.status
    if (status.state === 'signed-in') {
      expect(status.session.identity.subject).toBe('auth0|stored')
    }
    expect(window.location.search).not.toContain('code=')
  })

  it('reports a denied login without fabricating a player', async () => {    mockOidcServer()
    savePendingLogin({
      codeVerifier: 'verifier',
      state: 'good-state',
      redirectUri: 'http://localhost/',
      invitationGameId: null,
    })
    window.history.replaceState(null, '', '/?error=access_denied&state=good-state')

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('error'))
    const status = result.current.status
    if (status.state === 'error') {
      expect(status.message).toMatch(/denied/i)
      expect(status.message).not.toContain('access_denied=x')
    }
    expect(sessionStorage.getItem('temporal-rift.auth.session.v1')).toBeNull()
    expect(window.location.search).not.toContain('error=')
  })

  it('clears private state when the active session reaches its deadline', async () => {
    sessionStorage.setItem(
      'temporal-rift.auth.session.v1',
      JSON.stringify({ ...storedSession, expiresAtEpochMs: Date.now() + 30 }),
    )

    const { result } = renderHook(() => usePlayerSession(config))

    await waitFor(() => expect(result.current.status.state).toBe('signed-in'))
    await waitFor(() => expect(result.current.status.state).toBe('signed-out'), { timeout: 3000 })
    const status = result.current.status
    if (status.state === 'signed-out') {
      expect(status.reason).toMatch(/expired/i)
    }
    expect(sessionStorage.getItem('temporal-rift.auth.session.v1')).toBeNull()
  })
})
