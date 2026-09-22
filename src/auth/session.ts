/**
 * Identity-bound browser session on top of the maintained generic OIDC SDK.
 *
 * The SDK owns the OIDC protocol, token validation and token caching; this
 * module only maps the SDK user's claims to the player identity the shell
 * renders and sweeps the client's own private cache namespace on logout,
 * expiry or identity change.
 */

export interface PlayerIdentity {
  readonly subject: string
  readonly displayName: string | null
}

export interface AuthSession {
  readonly identity: PlayerIdentity
}

/** The subset of standard OIDC ID-token claims this module actually reads —
 * deliberately not the SDK's full `IdTokenClaims` (which mandates `iss`,
 * `aud`, `exp`, `iat`): every real `UserProfile` satisfies this structurally. */
export interface IdentityClaims {
  readonly sub?: string
  readonly preferred_username?: string
  readonly email?: string
  readonly name?: string
}

export function identityFromUser(profile: IdentityClaims): PlayerIdentity | null {
  if (typeof profile.sub !== 'string' || profile.sub.length === 0) {
    return null
  }
  return { subject: profile.sub, displayName: displayNameFrom(profile) }
}

function displayNameFrom(user: IdentityClaims): string | null {
  const candidates = [user.preferred_username, user.email, user.name]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate
    }
  }
  return null
}

export function sameIdentity(left: PlayerIdentity, right: PlayerIdentity): boolean {
  return left.subject === right.subject
}

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

/**
 * Clears the client's own private cache entries. The SDK's token cache is
 * cleared through its logout; call this alongside for logout, session
 * failure or identity change.
 */
export function clearPrivateCaches(storage: SessionStorageLike | null = sessionStorageOrNull()): void {
  if (!storage) {
    return
  }
  if (typeof storage.length !== 'number' || typeof storage.key !== 'function') {
    return
  }
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith('temporal-rift.private.')) {
      keys.push(key)
    }
  }
  for (const key of keys) {
    storage.removeItem(key)
  }
}
