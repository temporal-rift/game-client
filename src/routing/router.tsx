/**
 * The client's URL space as type-safe TanStack Router routes (see `paths.ts`
 * for the URLs themselves). The router mounts only under a signed-in session;
 * route params are checked against the server-issued reference pattern and
 * search params against Zod schemas, and loaders warm the query cache so pages
 * render from it (`staleTime: 'static'` reuses a cached answer as-is).
 */

import type { QueryClient } from '@tanstack/react-query'
import { Navigate, Outlet, createRootRouteWithContext, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { gameStateQuery, lobbyQuery, type QueryScope } from '../api/queries'
import { authCallbackSearchSchema, legacyInvitationSearchSchema } from '../auth/invitation'
import { GameRoute } from '../pages/GamePage'
import { HomeRedirect } from '../pages/HomeRedirect'
import { LobbyPage } from '../pages/LobbyPage'
import { isResourceReference } from './paths'
import { parseSearch, stringifySearch } from './search'

export interface RouterContext {
  readonly queryClient: QueryClient
  readonly scope: QueryScope
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: () => <Navigate to="/" replace />,
})

/**
 * `/` has no page of its own (see `HomeRedirect`). A legacy invitation
 * (`/?game=<lobbyId>`) lands on that lobby's page; any other search is ignored.
 */
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>): { readonly game?: string } => ({
    game: legacyInvitationSearchSchema.shape.game.safeParse(search.game).data,
  }),
  beforeLoad: ({ search }) => {
    if (search.game) {
      throw redirect({ to: '/lobbies/$lobbyId', params: { lobbyId: search.game }, replace: true })
    }
  },
  component: HomeRedirect,
})

const lobbyIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lobby',
  component: LobbyPage,
})

const lobbyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lobbies/$lobbyId',
  beforeLoad: ({ params }) => {
    if (!isResourceReference(params.lobbyId)) {
      throw redirect({ to: '/lobby', replace: true })
    }
  },
  // The page reports a failed read itself; the loader only warms the cache.
  loader: ({ context, params }) =>
    context.queryClient.query({ ...lobbyQuery(context.scope, params.lobbyId), staleTime: 'static' }).catch(() => undefined),
  component: LobbyPage,
})

const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/games/$gameId',
  beforeLoad: ({ params }) => {
    if (!isResourceReference(params.gameId)) {
      throw redirect({ to: '/', replace: true })
    }
  },
  loader: ({ context, params }) =>
    context.queryClient.query({ ...gameStateQuery(context.scope, params.gameId), staleTime: 'static' }).catch(() => undefined),
  component: GameRoute,
})

/**
 * The fixed OIDC redirect URI. The session completes a sign-in before the
 * router mounts, so a signed-in visit here (a bookmark, the back button) has
 * nothing to complete and goes home.
 */
const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  validateSearch: authCallbackSearchSchema,
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true })
  },
})

export const routeTree = rootRoute.addChildren([homeRoute, lobbyIndexRoute, lobbyRoute, gameRoute, authCallbackRoute])

export function createAppRouter(context: RouterContext) {
  return createRouter({ routeTree, context, parseSearch, stringifySearch })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
