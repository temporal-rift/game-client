/**
 * Identity-bound browser session on top of the maintained Auth0 SPA SDK.
 *
 * The SDK owns the OIDC protocol, token validation and token caching; this
 * module only maps the SDK user to the player identity the shell renders
 * and sweeps the client's own private cache namespace on logout, expiry
 * or identity change.
 */

import type { User } from '@auth0/auth0-spa-js'

export interface PlayerIdentity {
  readonly subject: string
  readonly displayName: string | null
}

export interface AuthSession {
  readonly identity: PlayerIdentity
}

export function identityFromUser(user: User): PlayerIdentity | null {
  if (typeof user.sub !== 'string' || user.sub.length === 0) {
    return null
  }
  const displayName =
    typeof user.preferred_username === 'string' && user.preferred_username.length > 0
      ? user.preferred_username
      : typeof user.email === 'string' && user.email.length > 0
        ? user.email
        : typeof user.name === 'string' && user.name.length > 0
          ? user.name
          : null
  return { subject: user.sub, displayName }
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
