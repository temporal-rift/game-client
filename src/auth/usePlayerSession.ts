import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User, UserManager } from 'oidc-client-ts'
import { createGameOidcClient } from './oidcClient'
import { clearPrivateCaches, identityFromUser, sameIdentity } from './session'
import type { AuthSession, PlayerIdentity } from './session'
import { cleanAuthCallbackUrl, parseAuthCallback, parseGameInvitation } from './invitation'
import type { AppConfig } from '../config/appConfig'

export type PlayerSessionStatus =
  | { readonly state: 'restoring' }
  | { readonly state: 'signed-out'; readonly reason: string | null }
  | { readonly state: 'signing-in' }
  | { readonly state: 'handling-callback' }
  | { readonly state: 'signed-in'; readonly session: AuthSession }
  | { readonly state: 'error'; readonly message: string }

export interface PlayerSession {
  readonly status: PlayerSessionStatus
  readonly signIn: () => Promise<void>
  readonly signOut: () => Promise<void>
  readonly handleUnauthorized: () => void
  readonly getAccessToken: () => Promise<string | undefined>
}

export interface SignInAppState {
  readonly gameId: string | null
}

const EXPIRED_REASON = 'Your session expired. Sign in again to continue.'

/** Removes OAuth fields from the address bar; parsed values stay in memory. */
function stripCallbackFromUrl(): void {
  window.history.replaceState(null, '', cleanAuthCallbackUrl(window.location.href))
}

function returnUrlPreservingGame(): string {
  const base = `${window.location.origin}${window.location.pathname}`
  const invitation = parseGameInvitation(window.location.search)
  return invitation ? `${base}?game=${encodeURIComponent(invitation.gameId)}` : base
}

function authErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const code = (error as { error?: unknown }).error
    return typeof code === 'string' ? code : null
  }
  return null
}

function friendlyAuthError(error: unknown): string {
  const code = authErrorCode(error)
  if (code === 'access_denied') {
    return 'Sign-in was denied. Try again or contact the game host.'
  }
  if (
    code === 'login_required' ||
    code === 'consent_required' ||
    code === 'interaction_required' ||
    code === 'account_selection_required' ||
    code === 'missing_refresh_token'
  ) {
    return EXPIRED_REASON
  }
  return 'Sign-in failed. Try signing in again.'
}

/**
 * Completes one authorization callback through the SDK, which owns code
 * validation, the token exchange and ID-token validation. The invitation
 * reference round-trips in the SDK's own `state`, never as identity.
 */
async function handleCallback(client: UserManager): Promise<PlayerSessionStatus> {
  let appState: SignInAppState | undefined
  let user: User
  try {
    user = await client.signinRedirectCallback()
    const candidate = (user.state ?? undefined) as Partial<SignInAppState> | undefined
    appState = { gameId: typeof candidate?.gameId === 'string' ? candidate.gameId : null }
  } catch (error) {
    stripCallbackFromUrl()
    return { state: 'error', message: friendlyAuthError(error) }
  }
  stripCallbackFromUrl()
  const restoredGameId =
    appState?.gameId != null ? parseGameInvitation(`?game=${encodeURIComponent(appState.gameId)}`)?.gameId : undefined
  if (restoredGameId) {
    const url = new URL(window.location.href)
    url.searchParams.set('game', restoredGameId)
    window.history.replaceState(null, '', url.toString())
  }
  const identity = identityFromUser(user.profile)
  if (!identity) {
    return { state: 'error', message: 'Sign-in did not complete. Try signing in again.' }
  }
  return { state: 'signed-in', session: { identity } }
}

// Single-flight for the authorization callback across StrictMode remounts:
// the SDK consumes its single-use transaction on the first call.
let callbackFlightKey: string | null = null
let callbackFlight: Promise<PlayerSessionStatus> | null = null

/**
 * Owns the identity-bound browser session on top of the maintained generic
 * OIDC SDK: interactive login, callback handling, reload restoration and
 * recoverable reauthentication. Token lifecycle and renewal belong to the
 * SDK; private gameplay state mounts only under a signed-in session and
 * unmounts (keyed by identity) when it ends.
 */
export function usePlayerSession(config: AppConfig | null): PlayerSession {
  const [status, setStatus] = useState<PlayerSessionStatus>({ state: 'restoring' })
  const lastIdentityRef = useRef<PlayerIdentity | null>(null)
  const client = useMemo(() => (config ? createGameOidcClient(config) : null), [config])

  useEffect(() => {
    if (!client) {
      return
    }

    async function restore(activeClient: UserManager): Promise<void> {
      const search = window.location.search
      const callback = parseAuthCallback(search)
      const isCallback = Boolean((callback.code && callback.state) || callback.error)
      if (!isCallback) {
        const user = await activeClient.getUser().catch(() => null)
        const identity = user ? identityFromUser(user.profile) : null
        if (identity) {
          lastIdentityRef.current = identity
          setStatus({ state: 'signed-in', session: { identity } })
        } else {
          setStatus({ state: 'signed-out', reason: null })
        }
        return
      }
      setStatus({ state: 'handling-callback' })
      if (callbackFlightKey !== search || !callbackFlight) {
        callbackFlightKey = search
        callbackFlight = handleCallback(activeClient).finally(() => {
          if (callbackFlightKey === search) {
            callbackFlightKey = null
            callbackFlight = null
          }
        })
      }
      const next = await callbackFlight
      if (next.state === 'signed-in') {
        const previous = lastIdentityRef.current
        lastIdentityRef.current = next.session.identity
        if (previous && !sameIdentity(previous, next.session.identity)) {
          clearPrivateCaches()
        }
      }
      setStatus(next)
    }

    void restore(client)
  }, [client])

  const signIn = useCallback(async () => {
    if (!client) {
      return
    }
    setStatus({ state: 'signing-in' })
    try {
      const invitation = parseGameInvitation(window.location.search)
      const appState: SignInAppState = { gameId: invitation?.gameId ?? null }
      await client.signinRedirect({ state: appState })
    } catch (error) {
      setStatus({ state: 'error', message: friendlyAuthError(error) })
    }
  }, [client])

  const signOut = useCallback(async () => {
    clearPrivateCaches()
    lastIdentityRef.current = null
    setStatus({ state: 'signed-out', reason: null })
    try {
      await client?.removeUser()
      await client?.signoutRedirect({ post_logout_redirect_uri: returnUrlPreservingGame() })
    } catch {
      // Local sign-out is already applied; the issuer's own logout redirect is best-effort.
    }
  }, [client])

  const handleUnauthorized = useCallback(() => {
    clearPrivateCaches()
    lastIdentityRef.current = null
    setStatus({ state: 'signed-out', reason: EXPIRED_REASON })
  }, [])

  const getAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!client) {
      return undefined
    }
    try {
      const current = await client.getUser()
      if (current && !current.expired) {
        return current.access_token
      }
      const renewed = await client.signinSilent()
      return renewed?.access_token
    } catch {
      clearPrivateCaches()
      lastIdentityRef.current = null
      setStatus({ state: 'signed-out', reason: EXPIRED_REASON })
      return undefined
    }
  }, [client])

  return useMemo(
    () => ({ status, signIn, signOut, handleUnauthorized, getAccessToken }),
    [status, signIn, signOut, handleUnauthorized, getAccessToken],
  )
}
