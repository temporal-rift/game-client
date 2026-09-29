/**
 * Invitation and callback URL helpers with a credential-safety guarantee:
 * player identity never comes from URLs and tokens/codes never enter
 * invitation URLs or application logs.
 */
import * as z from 'zod'
import { isResourceReference, lobbyPath, resourceReferenceSchema } from '../routing/paths'

export interface LobbyInvitation {
  readonly lobbyId: string
}

/** A lobby reference as typed or pasted: surrounding whitespace is not part of it. */
const typedReferenceSchema = z.string().trim().pipe(resourceReferenceSchema)

/**
 * The search of a legacy invitation. Before lobbies had their own route,
 * invitations carried the lobby reference in `?game=` on the root path, and
 * links already shared still work. Identity-like parameters (player, token,
 * code, state, …) are deliberately not part of the schema, so a crafted
 * invitation can never fabricate or steal a player session.
 */
export const legacyInvitationSearchSchema = z.object({ game: typedReferenceSchema })

function searchParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
}

/** Builds a shareable invitation: the lobby's own page, carrying nothing else. */
export function buildLobbyInvitationUrl(origin: string, lobbyId: string): string {
  let normalized = origin
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return `${normalized}${lobbyPath(lobbyId)}`
}

/** Reads a legacy `?game=<lobbyId>` invitation; malformed references are rejected rather than stored. */
export function parseLegacyLobbyInvitation(search: string): LobbyInvitation | null {
  const result = legacyInvitationSearchSchema.safeParse({ game: searchParams(search).get('game') })
  return result.success ? { lobbyId: result.data.game } : null
}

const LOBBY_PATH_PATTERN = /^\/lobbies\/([^/]+)$/

/**
 * The lobby a page names: its own page (`/lobbies/<lobbyId>`) or a legacy
 * invitation (`/?game=<lobbyId>`). Such a lobby wins over one remembered from
 * an earlier visit.
 */
export function lobbyIdFromLocation(pathname: string, search: string): string | null {
  const pathMatch = LOBBY_PATH_PATTERN.exec(pathname)
  if (pathMatch) {
    return isResourceReference(pathMatch[1]) ? pathMatch[1] : null
  }
  return pathname === '/' ? (parseLegacyLobbyInvitation(search)?.lobbyId ?? null) : null
}

/** The lobby reference an invitation URL carries, if it is exactly one of the two invitation shapes. */
function invitationCandidate(url: URL): string | null {
  if (url.hash) {
    return null
  }
  const pathMatch = LOBBY_PATH_PATTERN.exec(url.pathname)
  if (pathMatch) {
    return url.search === '' ? pathMatch[1] : null
  }
  if (url.pathname === '/' && url.searchParams.size === 1) {
    return url.searchParams.get('game')
  }
  return null
}

/**
 * One complete, unambiguous invitation URL: the lobby page with nothing
 * else, or the legacy root page carrying `game` as its only parameter.
 */
const invitationUrlSchema = z
  .url({ protocol: /^https?$/ })
  .transform((value) => new URL(value))
  .transform((url, context) => {
    const reference = resourceReferenceSchema.safeParse(invitationCandidate(url))
    if (!reference.success) {
      context.issues.push({ code: 'custom', message: 'Not an invitation URL.', input: url.href })
      return z.NEVER
    }
    return reference.data
  })

/**
 * Accepts either an exact lobby reference or one complete invitation URL
 * (`/lobbies/<lobbyId>`, or the legacy `/?game=<lobbyId>`). Bare query-like
 * text is never treated as another lobby.
 */
export const lobbyReferenceInputSchema = z.union([typedReferenceSchema, z.string().trim().pipe(invitationUrlSchema)])

export function parseLobbyReference(value: string): LobbyInvitation | null {
  const result = lobbyReferenceInputSchema.safeParse(value)
  return result.success ? { lobbyId: result.data } : null
}

// A callback field that is absent, repeated oddly or not text reads as absent.
const callbackField = z.string().nullable().catch(null)

/**
 * The OAuth fields of an `/auth/callback` search. Only these are read;
 * identity still comes from the tokens the SDK validates.
 */
export const authCallbackSearchSchema = z.object({
  code: callbackField,
  state: callbackField,
  error: callbackField,
  error_description: callbackField,
})

export interface AuthCallbackParams {
  readonly code: string | null
  readonly state: string | null
  readonly error: string | null
  readonly errorDescription: string | null
}

/** Reads only the OAuth callback fields; identity still comes from tokens. */
export function parseAuthCallback(search: string): AuthCallbackParams {
  const params = searchParams(search)
  const { code, state, error, error_description: errorDescription } = authCallbackSearchSchema.parse({
    code: params.get('code'),
    state: params.get('state'),
    error: params.get('error'),
    error_description: params.get('error_description'),
  })
  return { code, state, error, errorDescription }
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
