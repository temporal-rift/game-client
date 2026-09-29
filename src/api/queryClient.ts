import { QueryClient } from '@tanstack/react-query'

/**
 * Creates the cache for server state. Polling is the retry: each poll
 * backs off on its own (see `backoffDelayMs`), and commands never retry
 * blindly — a lost response is reconciled against authoritative state
 * first — so neither queries nor mutations retry automatically.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: true, refetchOnReconnect: true },
      mutations: { retry: 0 },
    },
  })
}

/** The app's one cache. Private: `clearPrivateCaches()` empties it on sign-out or identity change. */
export const queryClient = createQueryClient()
