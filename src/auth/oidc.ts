/**
 * Minimal OIDC discovery, authorization-URL construction and code exchange
 * for a public browser client (authorization code + PKCE, no secret).
 *
 * ID-token claims decoded here are display-only. Participant authorization
 * stays authoritative on the backend, which validates signatures itself.
 */

export class OidcError extends Error {
  readonly userMessage: string

  constructor(userMessage: string, cause?: unknown) {
    super(userMessage)
    this.name = 'OidcError'
    this.userMessage = userMessage
    if (cause !== undefined) {
      this.cause = cause
    }
  }
}

export interface OidcDiscovery {
  readonly issuer: string
  readonly authorizationEndpoint: string
  readonly tokenEndpoint: string
  readonly userinfoEndpoint: string | null
  readonly endSessionEndpoint: string | null
}

export interface TokenResult {
  readonly accessToken: string
  readonly idToken: string
  readonly expiresAtEpochMs: number
}

export interface IdTokenClaims {
  readonly subject: string
  readonly issuer: string
  readonly displayName: string | null
  readonly expiresAtEpochMs: number | null
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/g, '')
}

function requireHttpUrl(value: unknown): string {
  if (typeof value !== 'string') {
    throw new OidcError('The configured issuer returned an invalid discovery document.')
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new OidcError('The configured issuer returned an invalid discovery document.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new OidcError('The configured issuer returned an invalid discovery document.')
  }
  return value
}

/** Fetches and validates the issuer discovery document over HTTPS. */
export async function discoverOidc(issuerUrl: string, fetcher: typeof fetch = fetch): Promise<OidcDiscovery> {
  const issuer = trimTrailingSlashes(issuerUrl.trim())
  let response: Response
  try {
    response = await fetcher(`${issuer}/.well-known/openid-configuration`, {
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    throw new OidcError('Could not reach the configured sign-in service. Check your connection and try again.', error)
  }
  if (!response.ok) {
    throw new OidcError('The configured sign-in service is unavailable. Try again later.')
  }
  let document: Record<string, unknown>
  try {
    document = (await response.json()) as Record<string, unknown>
  } catch (error) {
    throw new OidcError('The configured sign-in service returned an invalid response.', error)
  }
  try {
    return {
      issuer,
      authorizationEndpoint: requireHttpUrl(document['authorization_endpoint']),
      tokenEndpoint: requireHttpUrl(document['token_endpoint']),
      userinfoEndpoint:
        document['userinfo_endpoint'] === undefined || document['userinfo_endpoint'] === null
          ? null
          : requireHttpUrl(document['userinfo_endpoint']),
      endSessionEndpoint:
        document['end_session_endpoint'] === undefined || document['end_session_endpoint'] === null
          ? null
          : requireHttpUrl(document['end_session_endpoint']),
    }
  } catch (error) {
    if (error instanceof OidcError) {
      throw error
    }
    throw new OidcError('The configured sign-in service returned an invalid response.', error)
  }
}

export interface AuthorizationUrlInput {
  readonly discovery: OidcDiscovery
  readonly clientId: string
  readonly redirectUri: string
  readonly codeChallenge: string
  readonly state: string
}

/**
 * Builds the sign-in redirect. Response mode stays at the default
 * (query parameters) and no client secret is involved at any step.
 */
export function buildAuthorizationUrl(input: AuthorizationUrlInput): string {
  const url = new URL(input.discovery.authorizationEndpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('scope', 'openid profile email')
  url.searchParams.set('code_challenge', input.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', input.state)
  return url.toString()
}

export interface CodeExchangeInput {
  readonly discovery: OidcDiscovery
  readonly clientId: string
  readonly redirectUri: string
  readonly code: string
  readonly codeVerifier: string
}

/** Exchanges the authorization code for tokens (public client, PKCE only). */
export async function exchangeCodeForTokens(
  input: CodeExchangeInput,
  fetcher: typeof fetch = fetch,
  nowEpochMs: number = Date.now(),
): Promise<TokenResult> {
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', input.code)
  body.set('redirect_uri', input.redirectUri)
  body.set('client_id', input.clientId)
  body.set('code_verifier', input.codeVerifier)

  let response: Response
  try {
    response = await fetcher(input.discovery.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
    })
  } catch (error) {
    throw new OidcError('Could not reach the configured sign-in service. Check your connection and try again.', error)
  }
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new OidcError('Sign-in was denied or expired. Try signing in again.')
    }
    throw new OidcError('The configured sign-in service is unavailable. Try again later.')
  }
  let payload: Record<string, unknown>
  try {
    payload = (await response.json()) as Record<string, unknown>
  } catch (error) {
    throw new OidcError('The configured sign-in service returned an invalid response.', error)
  }
  const accessToken = payload['access_token']
  const idToken = payload['id_token']
  const expiresIn = payload['expires_in']
  if (typeof accessToken !== 'string' || accessToken.length === 0 || typeof idToken !== 'string' || idToken.length === 0) {
    throw new OidcError('The configured sign-in service returned an invalid response.')
  }
  const expiresInSeconds = typeof expiresIn === 'number' && Number.isFinite(expiresIn) ? expiresIn : 300
  return {
    accessToken,
    idToken,
    expiresAtEpochMs: nowEpochMs + Math.max(0, expiresInSeconds) * 1000,
  }
}

function base64UrlDecodeToString(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + padding)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new TextDecoder().decode(bytes)
}

/**
 * Decodes the ID-token payload for display/expiry purposes only.
 * Signature validation is the backend's job; the browser never
 * fabricates identity from anything else (in particular, never
 * from invitation URL parameters).
 */
export function decodeIdTokenClaims(idToken: string): IdTokenClaims {
  const segments = idToken.split('.')
  if (segments.length < 2) {
    throw new OidcError('Sign-in returned an unusable identity. Try signing in again.')
  }
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(base64UrlDecodeToString(segments[1])) as Record<string, unknown>
  } catch {
    throw new OidcError('Sign-in returned an unusable identity. Try signing in again.')
  }
  const subject = payload['sub']
  const issuer = payload['iss']
  if (typeof subject !== 'string' || subject.length === 0 || typeof issuer !== 'string' || issuer.length === 0) {
    throw new OidcError('Sign-in returned an unusable identity. Try signing in again.')
  }
  const displayName =
    typeof payload['preferred_username'] === 'string' && payload['preferred_username'].length > 0
      ? (payload['preferred_username'] as string)
      : typeof payload['email'] === 'string' && payload['email'].length > 0
        ? (payload['email'] as string)
        : typeof payload['name'] === 'string' && payload['name'].length > 0
          ? (payload['name'] as string)
          : null
  const expiresAtEpochMs =
    typeof payload['exp'] === 'number' && Number.isFinite(payload['exp']) ? payload['exp'] * 1000 : null
  return { subject, issuer, displayName, expiresAtEpochMs }
}
