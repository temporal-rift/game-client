/**
 * Minimal OIDC discovery, authorization-URL construction and code exchange
 * for a public browser client (authorization code + PKCE, no secret).
 *
 * Endpoints travel over HTTPS except for loopback development hosts.
 * ID-token claims decoded here are display-only and checked against the
 * configured issuer/client; participant authorization stays authoritative
 * on the backend, which validates signatures itself.
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
  readonly audience: readonly string[]
  readonly authorizedParty: string | null
}

function trimTrailingSlashes(value: string): string {
  let end = value.length
  while (end > 0 && value[end - 1] === '/') {
    end -= 1
  }
  return value.slice(0, end)
}

/** Normalizes an issuer URL for equality checks (trailing slashes). */
export function normalizeIssuer(value: string): string {
  return trimTrailingSlashes(value.trim())
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.startsWith('127.')
}

/**
 * Requires HTTPS for OIDC URLs. Plain HTTP stays allowed only for loopback
 * hosts so local development against a local issuer keeps working while any
 * non-local endpoint that would carry codes, verifiers or tokens in
 * cleartext is rejected.
 */
function requireOidcUrl(value: unknown): string {
  if (typeof value !== 'string') {
    throw new OidcError('The configured issuer returned an invalid discovery document.')
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new OidcError('The configured issuer returned an invalid discovery document.')
  }
  if (url.protocol === 'https:') {
    return value
  }
  if (url.protocol === 'http:' && isLoopbackHost(url.hostname)) {
    return value
  }
  throw new OidcError('The configured issuer returned an invalid discovery document.')
}

/** Fetches and validates the issuer discovery document. */
export async function discoverOidc(issuerUrl: string, fetcher: typeof fetch = fetch): Promise<OidcDiscovery> {
  const issuer = trimTrailingSlashes(issuerUrl.trim())
  try {
    requireOidcUrl(issuer)
  } catch {
    throw new OidcError('The configured sign-in service URL is invalid. Fix its configuration and try again.')
  }
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
    const discoveredIssuer =
      typeof document['issuer'] === 'string' ? trimTrailingSlashes(document['issuer']) : null
    if (discoveredIssuer !== null && discoveredIssuer !== issuer) {
      throw new OidcError('The configured sign-in service returned an invalid discovery document.')
    }
    return {
      issuer,
      authorizationEndpoint: requireOidcUrl(document['authorization_endpoint']),
      tokenEndpoint: requireOidcUrl(document['token_endpoint']),
      userinfoEndpoint:
        document['userinfo_endpoint'] === undefined || document['userinfo_endpoint'] === null
          ? null
          : requireOidcUrl(document['userinfo_endpoint']),
      endSessionEndpoint:
        document['end_session_endpoint'] === undefined || document['end_session_endpoint'] === null
          ? null
          : requireOidcUrl(document['end_session_endpoint']),
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
  const padded = segment.replaceAll('-', '+').replaceAll('_', '/')
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + padding)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0
  }
  return new TextDecoder().decode(bytes)
}

function displayNameFrom(payload: Record<string, unknown>): string | null {
  const candidates = [payload['preferred_username'], payload['email'], payload['name']]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate
    }
  }
  return null
}

function audienceFrom(payload: Record<string, unknown>): readonly string[] {
  const audience = payload['aud']
  if (typeof audience === 'string') {
    return audience.length > 0 ? [audience] : []
  }
  if (Array.isArray(audience)) {
    return audience.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
  }
  return []
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
  const displayName = displayNameFrom(payload)
  const expiresAtEpochMs =
    typeof payload['exp'] === 'number' && Number.isFinite(payload['exp']) ? payload['exp'] * 1000 : null
  const authorizedParty =
    typeof payload['azp'] === 'string' && payload['azp'].length > 0 ? payload['azp'] : null
  return { subject, issuer, displayName, expiresAtEpochMs, audience: audienceFrom(payload), authorizedParty }
}

export interface ExpectedTokenAudience {
  readonly issuer: string
  readonly clientId: string
}

/**
 * Validates decoded ID-token claims against the configured issuer and
 * client before the browser binds them to a player identity: the token
 * must come from the configured issuer and, when it carries an audience
 * or authorized party, must be addressed to this client. Signature
 * verification stays with the backend resource servers, which remain
 * authoritative for participant authorization.
 */
export function validateIdTokenClaims(claims: IdTokenClaims, expected: ExpectedTokenAudience): void {
  if (trimTrailingSlashes(claims.issuer) !== trimTrailingSlashes(expected.issuer)) {
    throw new OidcError('Sign-in returned an identity from an unexpected issuer. Try signing in again.')
  }
  if (claims.audience.length > 0 && !claims.audience.includes(expected.clientId)) {
    throw new OidcError('Sign-in returned an identity for a different application. Try signing in again.')
  }
  if (claims.authorizedParty !== null && claims.authorizedParty !== expected.clientId) {
    throw new OidcError('Sign-in returned an identity for a different application. Try signing in again.')
  }
}
