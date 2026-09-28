/**
 * Invitation and callback URL helpers with a credential-safety guarantee:
 * player identity never comes from URLs and tokens/codes never enter
 * invitation URLs or application logs.
 */
import { isResourceReference, lobbyPath } from '../routing/paths'

export interface LobbyInvitation {
  readonly lobbyId: string;
}

// Before lobbies had their own route, invitations carried the lobby reference
// in this query parameter on the root path. Links already shared still work.
const LEGACY_INVITATION_PARAM = 'game'

const LOBBY_PATH_PATTERN = /^\/lobbies\/([^/]+)$/

/** Builds a shareable invitation: the lobby's own page, carrying nothing else. */
export function buildLobbyInvitationUrl(origin: string, lobbyId: string): string {
  let normalized = origin
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return `${normalized}${lobbyPath(lobbyId)}`
}

/**
 * Reads a legacy `?game=<lobbyId>` invitation. Identity-like parameters
 * (player, token, code, state, …) are deliberately ignored so a crafted
 * invitation can never fabricate or steal a player session, and malformed
 * references are rejected rather than stored.
 */
export function parseLegacyLobbyInvitation(search: string): LobbyInvitation | null {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const lobbyId = params.get(LEGACY_INVITATION_PARAM)?.trim()
  return isResourceReference(lobbyId) ? { lobbyId } : null
}

/**
 * Accepts either an exact lobby reference or one complete, unambiguous
 * invitation URL (`/lobbies/<lobbyId>`, or the legacy `/?game=<lobbyId>`).
 * Bare query-like text is never treated as another lobby.
 */
export function parseLobbyReference(value: string): LobbyInvitation | null {
  const reference = value.trim();
  if (isResourceReference(reference)) {
    return { lobbyId: reference };
  }
  let invitationUrl: URL;
  try {
    invitationUrl = new URL(reference);
  } catch {
    return null;
  }
  if ((invitationUrl.protocol !== 'https:' && invitationUrl.protocol !== 'http:') || invitationUrl.hash) {
    return null;
  }
  const pathMatch = LOBBY_PATH_PATTERN.exec(invitationUrl.pathname);
  if (pathMatch) {
    return invitationUrl.search === '' && isResourceReference(pathMatch[1]) ? { lobbyId: pathMatch[1] } : null;
  }
  if (invitationUrl.pathname !== '/' || invitationUrl.searchParams.size !== 1) {
    return null;
  }
  const lobbyId = invitationUrl.searchParams.get(LEGACY_INVITATION_PARAM);
  return isResourceReference(lobbyId) ? { lobbyId } : null;
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
