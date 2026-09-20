import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { discoverOidc, exchangeCodeForTokens, buildAuthorizationUrl, OidcError, type OidcDiscovery } from './oidc'
import { createCodeVerifier, createOAuthState, toCodeChallenge } from './pkce'
import {
  clearPrivateState,
  isSessionExpired,
  loadPendingLogin,
  loadSession,
  sameIdentity,
  savePendingLogin,
  saveSession,
  sessionFromTokens,
  type AuthSession,
} from './session'
import { cleanAuthCallbackUrl, parseAuthCallback } from './invitation'
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

function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`
}

function friendlyError(error: unknown): string {
  if (error instanceof OidcError) {
    return error.userMessage
  }
  return 'Sign-in failed unexpectedly. Try signing in again.'
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
    const activeConfig = config
    if (!activeConfig) {
      return
    }
    let cancelled = false

    async function restore(active: AppConfig): Promise<void> {
      const callback = parseAuthCallback(window.location.search)
      if (callback.code || callback.error || callback.state) {
        setStatus({ state: 'handling-callback' })
        try {
          const pending = loadPendingLogin()
          if (callback.error) {
            throw new OidcError(
              callback.error === 'access_denied'
                ? 'Sign-in was denied. Try again or contact the game host.'
                : 'Sign-in failed. Try signing in again.',
            )
          }
          if (!callback.code || !callback.state || !pending) {
            throw new OidcError('Sign-in did not complete. Try signing in again.')
          }
          if (callback.state !== pending.state) {
            throw new OidcError('Sign-in did not complete. Try signing in again.')
          }
          const discovery = await discoverOidc(active.oidcIssuerUrl)
          if (cancelled) {
            return
          }
          discoveryRef.current = discovery
          const tokens = await exchangeCodeForTokens({
            discovery,
            clientId: active.oidcClientId,
            redirectUri: pending.redirectUri,
            code: callback.code,
            codeVerifier: pending.codeVerifier,
          })
          if (cancelled) {
            return
          }
          const next = sessionFromTokens(tokens.accessToken, tokens.idToken, tokens.expiresAtEpochMs)
          const previous = loadSession()
          if (previous && !sameIdentity(previous.identity, next.identity)) {
            clearPrivateState()
          }
          saveSession(next)
          window.history.replaceState(null, '', cleanAuthCallbackUrl(window.location.href))
          setStatus({ state: 'signed-in', session: next })
        } catch (error) {
          if (cancelled) {
            return
          }
          clearPrivateState()
          window.history.replaceState(null, '', cleanAuthCallbackUrl(window.location.href))
          setStatus({ state: 'error', message: friendlyError(error) })
        }
        return
      }

      const restored = loadSession()
      if (!restored) {
        setStatus({ state: 'signed-out', reason: null })
        return
      }
      if (isSessionExpired(restored)) {
        clearPrivateState()
        setStatus({ state: 'signed-out', reason: 'Your session expired. Sign in again to continue.' })
        return
      }
      setStatus({ state: 'signed-in', session: restored })
    }

    void restore(activeConfig)
    return () => {
      cancelled = true
    }
  }, [config])

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
      savePendingLogin({ codeVerifier, state, redirectUri: uri })
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
    setStatus({ state: 'signed-out', reason: 'Your session expired. Sign in again to continue.' })
  }, [])

  return useMemo(() => ({ status, signIn, signOut, handleUnauthorized }), [status, signIn, signOut, handleUnauthorized])
}
