/**
 * Authenticated HTTP for the browser gameplay client.
 *
 * Every private API call carries a fresh access token from the OIDC SDK
 * as a Bearer credential. Token renewal is the SDK's job; when the
 * session cannot supply one (or the API answers 401) the caller clears
 * private state and offers reauthentication instead of retrying with a
 * stale identity.
 */

export type AccessTokenProvider = () => Promise<string | undefined>

export type UnauthorizedHandler = () => void

export interface AuthenticatedFetchOptions extends RequestInit {
  readonly onUnauthorized?: UnauthorizedHandler
}

/** Fetches with a fresh SDK Bearer token; never logs the token. Callers must
 * only pass `input` built from the trusted configured API origin (e.g. via
 * `encodeURIComponent`-escaped path segments) — never a URL assembled from
 * unescaped or cross-origin-influenced data, which would leak the Bearer
 * token to whatever origin that URL resolves to. */
export function createAuthenticatedFetch(getAccessToken: AccessTokenProvider) {
  return async function authenticatedFetch(
    input: RequestInfo | URL,
    init: AuthenticatedFetchOptions = {},
  ): Promise<Response> {
    const { onUnauthorized, ...requestInit } = init
    let accessToken: string | undefined
    try {
      accessToken = await getAccessToken()
    } catch {
      onUnauthorized?.()
      throw new Error('The player session cannot supply access credentials. Sign in again to continue.')
    }
    if (!accessToken) {
      onUnauthorized?.()
      throw new Error('The player session cannot supply access credentials. Sign in again to continue.')
    }
    const headers = new Headers(requestInit.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)
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
