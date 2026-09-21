/**
 * Invitation and callback URL helpers with a credential-safety guarantee:
 * player identity never comes from URL parameters and tokens/codes never
 * enter invitation URLs or application logs.
 */

export interface GameInvitation {
  readonly gameId: string
}

const INVITATION_PARAM = 'game'

// Server-issued game references are URL-safe slugs (uuids); anything else
// in the query string is ignored rather than stored or acted on.
const GAME_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

/** Builds a shareable invitation carrying only the game reference. */
export function buildGameInvitationUrl(origin: string, gameId: string): string {
  if (!GAME_REFERENCE_PATTERN.test(gameId)) {
    throw new Error('Cannot share an invitation with an invalid game reference.')
  }
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
 * Malformed game references are rejected rather than stored.
 *
 * Lobby invitations reuse the same `game` parameter carrying the lobbyId:
 * the lobby's pre-assigned game identity correlates later game reads, and
 * the existing sign-in flow already preserves this parameter through login.
 */
export function parseGameInvitation(search: string): GameInvitation | null {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const gameId = params.get(INVITATION_PARAM)?.trim()
  if (!gameId || !GAME_REFERENCE_PATTERN.test(gameId)) {
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

export interface LobbyInvitation {
  readonly lobbyId: string;
}

/**
 * Builds a shareable lobby invitation. The lobbyId travels in the same
 * `game` parameter so sign-in preserves it and reload recovers from it.
 */
export function buildLobbyInvitationUrl(origin: string, lobbyId: string): string {
  return buildGameInvitationUrl(origin, lobbyId);
}

/** Reads a lobby invitation from the URL without touching identity. */
export function parseLobbyInvitation(search: string): LobbyInvitation | null {
  const invitation = parseGameInvitation(search);
  return invitation ? { lobbyId: invitation.gameId } : null;
}

/** Persists the active lobby reference in the address bar for reload recovery. */
export function writeLobbyInvitationToUrl(lobbyId: string | null): void {
  const url = new URL(window.location.href);
  if (lobbyId) {
    url.searchParams.set(INVITATION_PARAM, lobbyId);
  } else {
    url.searchParams.delete(INVITATION_PARAM);
  }
  window.history.replaceState(null, '', url.toString());
}
