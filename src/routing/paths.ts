/**
 * The client's URL space. Every page names the resource it shows, so reloads,
 * bookmarks and shared links land on the same page:
 *
 * - `/lobby`: create or join a game
 * - `/lobbies/{lobbyId}`: one lobby, also the shareable invitation
 * - `/games/{gameId}`: one game's board, action rounds and results
 * - `/auth/callback`: the single OIDC redirect URI (exact-match registration)
 *
 * Identity never travels in these URLs: lobby and game references are
 * server-issued slugs, and membership is always confirmed server-side.
 */

export const AUTH_CALLBACK_PATH = '/auth/callback'
export const HOME_PATH = '/'
export const LOBBY_PATH = '/lobby'
export const LOBBY_ROUTE = '/lobbies/:lobbyId'
export const GAME_ROUTE = '/games/:gameId'

// Server-issued lobby and game references are URL-safe slugs (uuids); anything
// else is rejected rather than stored or acted on.
const RESOURCE_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

export function isResourceReference(value: unknown): value is string {
  return typeof value === 'string' && RESOURCE_REFERENCE_PATTERN.test(value)
}

function requireReference(reference: string, kind: string): string {
  if (!isResourceReference(reference)) {
    throw new Error(`Cannot build a link with an invalid ${kind} reference.`)
  }
  return reference
}

export function lobbyPath(lobbyId: string): string {
  return `/lobbies/${requireReference(lobbyId, 'lobby')}`
}

export function gamePath(gameId: string): string {
  return `/games/${requireReference(gameId, 'game')}`
}

// Any fixed same-origin base works: it only anchors relative resolution.
const RESOLUTION_BASE = 'https://client.invalid'

/**
 * Accepts only a same-origin, app-relative path to return to after sign-in, so
 * the OIDC `state` round-trip can never become an open redirect. The callback
 * path itself is refused to avoid re-entering the callback handler.
 */
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null
  }
  let url: URL
  try {
    url = new URL(value, RESOLUTION_BASE)
  } catch {
    return null
  }
  if (url.origin !== RESOLUTION_BASE || url.pathname === AUTH_CALLBACK_PATH) {
    return null
  }
  return `${url.pathname}${url.search}`
}
