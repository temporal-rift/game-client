import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { discoverOidc, exchangeCodeForTokens, buildAuthorizationUrl, OidcError, normalizeIssuer } from './oidc'
import type { OidcDiscovery } from './oidc'
import { createCodeVerifier, createOAuthState, toCodeChallenge } from './pkce'
import {
  clearPendingLogin,
  clearPrivateState,
  isSessionExpired,
  loadPendingLogin,
  loadSession,
  sameIdentity,
  savePendingLogin,
  saveSession,
  sessionFromValidatedTokens,
} from './session'
import type { AuthSession, PendingLogin } from './session'
import { cleanAuthCallbackUrl, parseAuthCallback, parseGameInvitation } from './invitation'
import type { AuthCallbackParams } from './invitation'
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
  readonly signOut: () => void
  readonly handleUnauthorized: () => void
}

const EXPIRED_REASON = 'Your session expired. Sign in again to continue.'

// Largest setTimeout delay before 32-bit overflow coerces it to ~1ms.
const MAX_TIMER_DELAY_MS = 2_147_483_647

function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`
}

function friendlyError(error: unknown): string {
  if (error instanceof OidcError) {
    return error.userMessage
  }
  return 'Sign-in failed unexpectedly. Try signing in again.'
}

/** Removes OAuth fields from the address bar; parsed values stay in memory. */
function stripCallbackFromUrl(): void {
  window.history.replaceState(null, '', cleanAuthCallbackUrl(window.location.href))
}

/** Restores the stored session, clearing it when expired or misconfigured. */
function restoreStoredSession(active: AppConfig): PlayerSessionStatus {
  const restored = loadSession()
  if (!restored) {
    return { state: 'signed-out', reason: null }
  }
  if (isSessionExpired(restored)) {
    clearPrivateState()
    return { state: 'signed-out', reason: EXPIRED_REASON }
  }
  if (normalizeIssuer(restored.identity.issuer) !== normalizeIssuer(active.oidcIssuerUrl)) {
    clearPrivateState()
    return { state: 'signed-out', reason: 'The sign-in configuration changed. Sign in again to continue.' }
  }
  if (restored.clientId !== active.oidcClientId) {
    clearPrivateState()
    return { state: 'signed-out', reason: 'The sign-in configuration changed. Sign in again to continue.' }
  }
  return { state: 'signed-in', session: restored }
}

function denialMessage(callback: AuthCallbackParams): string {
  return callback.error === 'access_denied'
    ? 'Sign-in was denied. Try again or contact the game host.'
    : 'Sign-in failed. Try signing in again.'
}

/**
 * Completes one authorization callback. The pending login is consumed
 * synchronously (single-flight under StrictMode remounts) and the URL is
 * cleaned before any network work. Failures discard only the pending login
 * and preserve an existing session; only an explicit logout, expiry or
 * identity change clears private state.
 */
async function handleCallback(
  active: AppConfig,
  callback: AuthCallbackParams,
  pending: PendingLogin,
): Promise<PlayerSessionStatus> {
  if (!callback.state || callback.state !== pending.state) {
    return restoreStoredSession(active)
  }
  try {
    if (callback.error) {
      throw new OidcError(denialMessage(callback))
    }
    if (!callback.code) {
      throw new OidcError('Sign-in did not complete. Try signing in again.')
    }
    const discovery = await discoverOidc(active.oidcIssuerUrl)
    const tokens = await exchangeCodeForTokens({
      discovery,
      clientId: active.oidcClientId,
      redirectUri: pending.redirectUri,
      code: callback.code,
      codeVerifier: pending.codeVerifier,
    })
    const next = sessionFromValidatedTokens({
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      expiresAtEpochMs: tokens.expiresAtEpochMs,
      expectedIssuer: active.oidcIssuerUrl,
      expectedClientId: active.oidcClientId,
    })
    const previous = loadSession()
    if (previous && !sameIdentity(previous.identity, next.identity)) {
      clearPrivateState()
    }
    saveSession(next)
    if (pending.invitationGameId) {
      const url = new URL(window.location.href)
      url.searchParams.set('game', pending.invitationGameId)
      window.history.replaceState(null, '', url.toString())
    }
    return { state: 'signed-in', session: next }
  } catch (error) {
    const fallback = restoreStoredSession(active)
    if (fallback.state === 'signed-in') {
      return fallback
    }
    return { state: 'error', message: friendlyError(error) }
  }
}

/**
 * Owns the identity-bound browser session: OIDC PKCE login, callback
 * exchange, reload restoration, expiry/logout/identity-change clearing and
 * recoverable reauthentication. Private gameplay state mounts only under a
 * signed-in session and unmounts (keyed by identity) when it ends.
 */
export function usePlayerSession(config: AppConfig | null): PlayerSession {
  const [status, setStatus] = useState<PlayerSessionStatus>({ state: 'restoring' })
  const discoveryRef = useRef<OidcDiscovery | null>(null)
  const configRef = useRef<AppConfig | null>(config)

  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    const active = config
    if (!active) {
      return
    }
    async function restore(activeConfig: AppConfig): Promise<void> {
      const callback = parseAuthCallback(window.location.search)
      if (!callback.code && !callback.error && !callback.state) {
        setStatus(restoreStoredSession(activeConfig))
        return
      }
      setStatus({ state: 'handling-callback' })
      // Consume synchronously: a StrictMode remount must not exchange the
      // single-use code twice, and the code must leave the URL before awaits.
      const pending = loadPendingLogin()
      clearPendingLogin()
      stripCallbackFromUrl()
      if (!pending) {
        setStatus(restoreStoredSession(activeConfig))
        return
      }
      // The result is applied even when a StrictMode remount cancelled this
      // run: the remount falls through to the stored-session path while the
      // single consumed exchange finishes here and must win.
      setStatus(await handleCallback(activeConfig, callback, pending))
    }

    void restore(active)
  }, [config])

  useEffect(() => {
    if (status.state !== 'signed-in') {
      return
    }
    const session = status.session
    let timer: ReturnType<typeof setTimeout> | undefined
    const checkExpiry = (): void => {
      const remaining = session.expiresAtEpochMs - Date.now()
      if (remaining <= 0) {
        clearPrivateState()
        setStatus({ state: 'signed-out', reason: EXPIRED_REASON })
        return
      }
      // Re-arm below the 32-bit timer limit; distant expiries re-check later.
      timer = setTimeout(checkExpiry, Math.min(remaining, MAX_TIMER_DELAY_MS))
    }
    const initialRemaining = session.expiresAtEpochMs - Date.now()
    timer = setTimeout(checkExpiry, Math.min(Math.max(0, initialRemaining), MAX_TIMER_DELAY_MS))
    return () => clearTimeout(timer)
  }, [status])

  const signIn = useCallback(async () => {
    const current = configRef.current
    if (!current) {
      return
    }
    setStatus({ state: 'signing-in' })
    try {
      const discovery = discoveryRef.current ?? (await discoverOidc(current.oidcIssuerUrl))
      discoveryRef.current = discovery
      const codeVerifier = createCodeVerifier()
      const state = createOAuthState()
      const challenge = await toCodeChallenge(codeVerifier)
      const uri = redirectUri()
      const invitation = parseGameInvitation(window.location.search)
      savePendingLogin({ codeVerifier, state, redirectUri: uri, invitationGameId: invitation?.gameId ?? null })
      window.location.assign(
        buildAuthorizationUrl({
          discovery,
          clientId: current.oidcClientId,
          redirectUri: uri,
          codeChallenge: challenge,
          state,
        }),
      )
    } catch (error) {
      setStatus({ state: 'error', message: friendlyError(error) })
    }
  }, [])

  const signOut = useCallback(() => {
    clearPrivateState()
    setStatus({ state: 'signed-out', reason: null })
  }, [])

  const handleUnauthorized = useCallback(() => {
    clearPrivateState()
    setStatus({ state: 'signed-out', reason: EXPIRED_REASON })
  }, [])

  return useMemo(() => ({ status, signIn, signOut, handleUnauthorized }), [status, signIn, signOut, handleUnauthorized])
}
