/**
 * Authenticated HTTP for the browser gameplay client.
 *
 * Every private API call carries the current access token as a Bearer
 * credential. A 401 means the session expired or was revoked: the caller
 * clears private state and offers reauthentication instead of retrying
 * with a stale identity.
 */

import type { AuthSession } from './session'

export type UnauthorizedHandler = () => void

export function authorizationHeader(session: AuthSession): string {
  return `Bearer ${session.accessToken}`
}

export interface AuthenticatedFetchOptions extends RequestInit {
  readonly onUnauthorized?: UnauthorizedHandler
}

/** Fetches with the session Bearer token; never logs the token. */
export function createAuthenticatedFetch(session: AuthSession) {
  return async function authenticatedFetch(input: RequestInfo | URL, init: AuthenticatedFetchOptions = {}): Promise<Response> {
    const { onUnauthorized, ...requestInit } = init
    const headers = new Headers(requestInit.headers)
    headers.set('Authorization', authorizationHeader(session))
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }
    const response = await fetch(input, { ...requestInit, headers })
    if (response.status === 401) {
      onUnauthorized?.()
    }
    return response
  }
}

/** Confirms the session against the OIDC userinfo endpoint when present. */
export async function verifySessionAtUserinfo(
  userinfoEndpoint: string,
  session: AuthSession,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const response = await fetcher(userinfoEndpoint, {
    headers: { Authorization: authorizationHeader(session), Accept: 'application/json' },
  })
  return response.ok
}
