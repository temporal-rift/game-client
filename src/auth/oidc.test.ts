import { describe, expect, it, vi } from 'vitest'
import {
  buildAuthorizationUrl,
  decodeIdTokenClaims,
  discoverOidc,
  exchangeCodeForTokens,
  OidcError,
  type OidcDiscovery,
} from './oidc'

const discovery: OidcDiscovery = {
  issuer: 'https://issuer.example.test',
  authorizationEndpoint: 'https://issuer.example.test/authorize',
  tokenEndpoint: 'https://issuer.example.test/token',
  userinfoEndpoint: 'https://issuer.example.test/userinfo',
  endSessionEndpoint: null,
}

function idToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.signature`
}

describe('discoverOidc', () => {
  it('returns endpoints from a valid discovery document', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authorization_endpoint: discovery.authorizationEndpoint,
        token_endpoint: discovery.tokenEndpoint,
        userinfo_endpoint: discovery.userinfoEndpoint,
      }),
    })

    await expect(discoverOidc('https://issuer.example.test/', fetcher as unknown as typeof fetch)).resolves.toEqual({
      ...discovery,
      endSessionEndpoint: null,
    })
  })

  it('reports an unreachable issuer as recoverable', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'))

    const error = await discoverOidc('https://issuer.example.test', fetcher as unknown as typeof fetch).catch(
      (cause: unknown) => cause,
    )
    expect(error).toBeInstanceOf(OidcError)
    expect((error as OidcError).userMessage).toMatch(/connection/i)
  })

  it('rejects a discovery document without endpoints', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })

    await expect(discoverOidc('https://issuer.example.test', fetcher as unknown as typeof fetch)).rejects.toBeInstanceOf(
      OidcError,
    )
  })
})

describe('buildAuthorizationUrl', () => {
  it('uses code flow with PKCE and no client secret', () => {
    const url = new URL(
      buildAuthorizationUrl({
        discovery,
        clientId: 'game-client',
        redirectUri: 'https://app.example.test/',
        codeChallenge: 'challenge',
        state: 'opaque-state',
      }),
    )

    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge')).toBe('challenge')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe('opaque-state')
    expect(url.searchParams.get('scope')).toContain('openid')
    expect(url.toString()).not.toContain('client_secret')
    expect(url.toString()).not.toContain('code_verifier')
  })
})

describe('exchangeCodeForTokens', () => {
  it('exchanges a code with verifier and without a secret', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'access', id_token: 'id', expires_in: 300 }),
    })

    const result = await exchangeCodeForTokens(
      {
        discovery,
        clientId: 'game-client',
        redirectUri: 'https://app.example.test/',
        code: 'auth-code',
        codeVerifier: 'verifier',
      },
      fetcher as unknown as typeof fetch,
      1_000,
    )

    expect(result).toEqual({ accessToken: 'access', idToken: 'id', expiresAtEpochMs: 301_000 })
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit]
    const body = new URLSearchParams(init.body as string)
    expect(body.get('code_verifier')).toBe('verifier')
    expect(body.get('client_id')).toBe('game-client')
    expect(body.toString()).not.toContain('client_secret')
  })

  it('maps denial to a recoverable message without leaking tokens', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) })

    const error = await exchangeCodeForTokens(
      {
        discovery,
        clientId: 'game-client',
        redirectUri: 'https://app.example.test/',
        code: 'bad-code',
        codeVerifier: 'verifier',
      },
      fetcher as unknown as typeof fetch,
    ).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(OidcError)
    const message = (error as OidcError).userMessage
    expect(message).toMatch(/denied|expired/i)
    expect(message).not.toContain('bad-code')
    expect(message).not.toContain('verifier')
  })
})

describe('decodeIdTokenClaims', () => {
  it('decodes subject, issuer and display name', () => {
    const claims = decodeIdTokenClaims(
      idToken({ sub: 'auth0|abc', iss: 'https://issuer.example.test', preferred_username: 'player-one' }),
    )

    expect(claims).toEqual({
      subject: 'auth0|abc',
      issuer: 'https://issuer.example.test',
      displayName: 'player-one',
      expiresAtEpochMs: null,
    })
  })

  it('rejects tokens without identity', () => {
    expect(() => decodeIdTokenClaims('not-a-token')).toThrow(OidcError)
    expect(() => decodeIdTokenClaims(idToken({ iss: 'https://issuer.example.test' }))).toThrow(OidcError)
  })
})
