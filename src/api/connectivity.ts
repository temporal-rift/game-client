export type ConnectivityResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string }

/**
 * Confirms the configured API origin is reachable before trusting any
 * fixture or (later) live gameplay state. A failure here must never be
 * papered over with invented player identity or game state.
 */
export async function checkApiConnectivity(apiBaseUrl: string): Promise<ConnectivityResult> {
  try {
    const response = await fetch(new URL('/actuator/health', apiBaseUrl), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      return { ok: false, reason: `API health check returned status ${response.status}.` }
    }

    return { ok: true }
  } catch {
    return { ok: false, reason: 'Could not reach the configured API. Check your connection and try again.' }
  }
}
