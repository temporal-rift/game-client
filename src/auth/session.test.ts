import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPendingLogin,
  clearPrivateState,
  identityKey,
  isSessionExpired,
  loadPendingLogin,
  loadSession,
  sameIdentity,
  savePendingLogin,
  saveSession,
  sessionFromValidatedTokens,
  type AuthSession,
} from './session'
import { OidcError } from './oidc'

function idToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.signature`
}

function memoryStorage(): Storage {
  const backing = new Map<string, string>()
  return {
    get length() {
      return backing.size
    },
    clear: () => backing.clear(),
    getItem: (key: string) => backing.get(key) ?? null,
    key: (index: number) => [...backing.keys()][index] ?? null,
    removeItem: (key: string) => {
      backing.delete(key)
    },
    setItem: (key: string, value: string) => {
      backing.set(key, value)
    },
  } as Storage
}

const session: AuthSession = {
  accessToken: 'access',
  idToken: 'id',
  expiresAtEpochMs: 2_000,
  identity: { subject: 'auth0|one', issuer: 'https://issuer.example.test', displayName: 'one' },
  clientId: 'game-client',
}

describe('player session storage', () => {
  let storage: Storage

  beforeEach(() => {
    storage = memoryStorage()
  })

  it('round-trips sessions and pending logins per browser context', () => {
    saveSession(session, storage)
    savePendingLogin(
      { codeVerifier: 'verifier', state: 'state', redirectUri: 'https://app/', invitationGameId: 'game-1' },
      storage,
    )

    expect(loadSession(storage)).toEqual(session)
    expect(loadPendingLogin(storage)).toEqual({
      codeVerifier: 'verifier',
      state: 'state',
      redirectUri: 'https://app/',
      invitationGameId: 'game-1',
    })

    const otherContext = memoryStorage()
    expect(loadSession(otherContext)).toBeNull()
  })

  it('discards only the pending login while preserving the session', () => {
    saveSession(session, storage)
    savePendingLogin(
      { codeVerifier: 'v', state: 's', redirectUri: 'https://app/', invitationGameId: null },
      storage,
    )

    clearPendingLogin(storage)

    expect(loadSession(storage)).toEqual(session)
    expect(loadPendingLogin(storage)).toBeNull()
  })

  it('detects expiry and identity changes', () => {
    expect(isSessionExpired(session, 1_999)).toBe(false)
    expect(isSessionExpired(session, 2_000)).toBe(true)
    expect(sameIdentity(session.identity, { ...session.identity })).toBe(true)
    expect(sameIdentity(session.identity, { ...session.identity, subject: 'auth0|two' })).toBe(false)
    expect(identityKey(session.identity)).toContain('auth0|one')
  })

  it('rejects malformed stored sessions instead of fabricating identity', () => {
    storage.setItem('temporal-rift.auth.session.v1', '{"accessToken":1}')
    expect(loadSession(storage)).toBeNull()
  })

  it('clears sessions, pending logins and private caches together', () => {
    saveSession(session, storage)
    savePendingLogin({ codeVerifier: 'v', state: 's', redirectUri: 'https://app/', invitationGameId: null }, storage)
    storage.setItem('temporal-rift.private.hand', 'private')
    storage.setItem('unrelated', 'keep')

    clearPrivateState(storage)

    expect(loadSession(storage)).toBeNull()
    expect(loadPendingLogin(storage)).toBeNull()
    expect(storage.getItem('temporal-rift.private.hand')).toBeNull()
    expect(storage.getItem('unrelated')).toBe('keep')
  })

  it('builds sessions from validated tokens with the earlier token expiry', () => {
    const built = sessionFromValidatedTokens({
      accessToken: 'access',
      idToken: idToken({ sub: 'auth0|one', iss: 'https://issuer.example.test', aud: 'game-client', exp: 1 }),
      expiresAtEpochMs: 500_000,
      expectedIssuer: 'https://issuer.example.test',
      expectedClientId: 'game-client',
    })

    expect(built.identity.subject).toBe('auth0|one')
    expect(built.expiresAtEpochMs).toBe(1_000)
  })

  it('rejects tokens from an unexpected issuer or application', () => {
    const input = {
      accessToken: 'access',
      expiresAtEpochMs: 500_000,
      expectedIssuer: 'https://issuer.example.test',
      expectedClientId: 'game-client',
    }

    expect(() =>
      sessionFromValidatedTokens({
        ...input,
        idToken: idToken({ sub: 'auth0|one', iss: 'https://other.example.test' }),
      }),
    ).toThrow(OidcError)
    expect(() =>
      sessionFromValidatedTokens({
        ...input,
        idToken: idToken({ sub: 'auth0|one', iss: 'https://issuer.example.test', aud: 'other-app' }),
      }),
    ).toThrow(OidcError)
  })
})
