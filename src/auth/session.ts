/**
 * Identity-bound browser session persistence.
 *
 * Sessions live in sessionStorage so two independent browser contexts keep
 * separate identities, a reload restores the same player, and closing the
 * context drops private state. Expiration, logout or an observed identity
 * change clears prior private state before anything new is stored.
 */

import { decodeIdTokenClaims, OidcError, validateIdTokenClaims } from './oidc'

export interface PlayerIdentity {
  readonly subject: string
  readonly issuer: string
  readonly displayName: string | null
}

export interface AuthSession {
  readonly accessToken: string
  readonly idToken: string
  readonly expiresAtEpochMs: number
  readonly identity: PlayerIdentity
}

export interface PendingLogin {
  readonly codeVerifier: string
  readonly state: string
  readonly redirectUri: string
  readonly invitationGameId: string | null
}

const SESSION_KEY = 'temporal-rift.auth.session.v1'
const PENDING_LOGIN_KEY = 'temporal-rift.auth.pending-login.v1'

export type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> &
  Partial<Pick<Storage, 'length' | 'key'>>;

function sessionStorageOrNull(): SessionStorageLike | null {
  try {
    if (typeof sessionStorage === 'undefined') {
      return null
    }
    return sessionStorage
  } catch {
    return null
  }
}

/** Stable identity key used to detect a changed player (iss + sub). */
export function identityKey(identity: PlayerIdentity): string {
  return `${identity.issuer}|${identity.subject}`
}

export function sameIdentity(left: PlayerIdentity, right: PlayerIdentity): boolean {
  return identityKey(left) === identityKey(right)
}

export function isSessionExpired(session: AuthSession, nowEpochMs: number = Date.now()): boolean {
  return session.expiresAtEpochMs <= nowEpochMs
}

export interface ValidatedTokenInput {
  readonly accessToken: string
  readonly idToken: string
  readonly expiresAtEpochMs: number
  readonly expectedIssuer: string
  readonly expectedClientId: string
}

/**
 * Builds a session from fresh tokens after checking the ID-token claims
 * against the configured issuer and client. Rejects tokens issued for a
 * different issuer or application before they can bind an identity.
 */
export function sessionFromValidatedTokens(input: ValidatedTokenInput): AuthSession {
  if (input.accessToken.length === 0) {
    throw new OidcError('Sign-in returned an unusable credential. Try signing in again.')
  }
  const claims = decodeIdTokenClaims(input.idToken)
  validateIdTokenClaims(claims, { issuer: input.expectedIssuer, clientId: input.expectedClientId })
  const effectiveExpiry =
    claims.expiresAtEpochMs !== null
      ? Math.min(input.expiresAtEpochMs, claims.expiresAtEpochMs)
      : input.expiresAtEpochMs
  return {
    accessToken: input.accessToken,
    idToken: input.idToken,
    expiresAtEpochMs: effectiveExpiry,
    identity: { subject: claims.subject, issuer: claims.issuer, displayName: claims.displayName },
  }
}

function parseSession(raw: string | null): AuthSession | null {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.idToken !== 'string' ||
      typeof parsed.expiresAtEpochMs !== 'number' ||
      typeof parsed.identity?.subject !== 'string' ||
      typeof parsed.identity?.issuer !== 'string'
    ) {
      return null
    }
    return parsed as AuthSession
  } catch {
    return null
  }
}

export function loadSession(storage: SessionStorageLike | null = sessionStorageOrNull()): AuthSession | null {
  if (!storage) {
    return null
  }
  return parseSession(storage.getItem(SESSION_KEY))
}

export function saveSession(session: AuthSession, storage: SessionStorageLike | null = sessionStorageOrNull()): void {
  storage?.setItem(SESSION_KEY, JSON.stringify(session))
}

export function loadPendingLogin(
  storage: SessionStorageLike | null = sessionStorageOrNull(),
): PendingLogin | null {
  if (!storage) {
    return null
  }
  const raw = storage.getItem(PENDING_LOGIN_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PendingLogin>
    if (
      typeof parsed.codeVerifier !== 'string' ||
      typeof parsed.state !== 'string' ||
      typeof parsed.redirectUri !== 'string'
    ) {
      return null
    }
    return {
      codeVerifier: parsed.codeVerifier,
      state: parsed.state,
      redirectUri: parsed.redirectUri,
      invitationGameId: typeof parsed.invitationGameId === 'string' ? parsed.invitationGameId : null,
    }
  } catch {
    return null
  }
}

export function savePendingLogin(
  pending: PendingLogin,
  storage: SessionStorageLike | null = sessionStorageOrNull(),
): void {
  storage?.setItem(PENDING_LOGIN_KEY, JSON.stringify(pending))
}

/** Discards only the pending PKCE login, preserving any signed-in session. */
export function clearPendingLogin(storage: SessionStorageLike | null = sessionStorageOrNull()): void {
  storage?.removeItem(PENDING_LOGIN_KEY)
}

/**
 * Clears the session, any pending PKCE login and every namespaced private
 * cache entry. Call on logout, expiry or identity change before storing
 * anything for the new perspective.
 */
export function clearPrivateState(storage: SessionStorageLike | null = sessionStorageOrNull()): void {
  if (!storage) {
    return
  }
  storage.removeItem(SESSION_KEY)
  storage.removeItem(PENDING_LOGIN_KEY)
  const keys: string[] = []
  if (typeof storage.length === 'number' && typeof storage.key === 'function') {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key?.startsWith('temporal-rift.private.')) {
        keys.push(key)
      }
    }
  }
  for (const key of keys) {
    storage.removeItem(key)
  }
}
