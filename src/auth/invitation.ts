/**
 * Invitation and callback URL helpers with a credential-safety guarantee:
 * player identity never comes from URL parameters and tokens/codes never
 * enter invitation URLs or application logs.
 */

export interface GameInvitation {
  readonly gameId: string
}

const INVITATION_PARAM = 'game'

/** Builds a shareable invitation carrying only the game reference. */
export function buildGameInvitationUrl(origin: string, gameId: string): string {
  let normalized = origin
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return `${normalized}/?${INVITATION_PARAM}=${encodeURIComponent(gameId)}`
}

/**
 * Reads only the game reference from a URL query string. Identity-like
 * parameters (player, token, code, state, …) are deliberately ignored so a
 * crafted invitation can never fabricate or steal a player session.
 */
export function parseGameInvitation(search: string): GameInvitation | null {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const gameId = params.get(INVITATION_PARAM)?.trim()
  if (!gameId) {
    return null
  }
  return { gameId }
}

export interface AuthCallbackParams {
  readonly code: string | null
  readonly state: string | null
  readonly error: string | null
  readonly errorDescription: string | null
}

/** Reads only the OAuth callback fields; identity still comes from tokens. */
export function parseAuthCallback(search: string): AuthCallbackParams {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  return {
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
    errorDescription: params.get('error_description'),
  }
}

/**
 * Removes OAuth callback fields from a URL while preserving the game
 * invitation reference, so codes never linger in history or shared links.
 */
export function cleanAuthCallbackUrl(href: string): string {
  const url = new URL(href)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.searchParams.delete('session_state')
  url.searchParams.delete('error')
  url.searchParams.delete('error_description')
  return url.toString()
}

/** True when a URL visibly carries credential material (for tests/guards). */
export function urlCarriesCredentials(href: string): boolean {
  const lowered = href.toLowerCase()
  return (
    lowered.includes('access_token') ||
    lowered.includes('id_token') ||
    lowered.includes('code_verifier') ||
    lowered.includes('client_secret')
  )
}
