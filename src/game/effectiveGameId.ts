import { useEffect, useMemo } from 'react'

const STORED_GAME_STORAGE_KEY = 'temporal-rift.private.resultsGameId'

function storageKeyFor(perspectiveKey: string | null): string {
  return perspectiveKey ? `${STORED_GAME_STORAGE_KEY}.${perspectiveKey}` : STORED_GAME_STORAGE_KEY
}

function readStoredGameId(perspectiveKey: string | null): string | null {
  try {
    const value = sessionStorage.getItem(storageKeyFor(perspectiveKey))
    return value && value.length > 0 ? value : null
  } catch {
    return null
  }
}

function writeStoredGameId(gameId: string, perspectiveKey: string | null): void {
  try {
    sessionStorage.setItem(storageKeyFor(perspectiveKey), gameId)
  } catch {
    // Reload recovery is best-effort; authoritative state stays server-side.
  }
}

/**
 * Resolves the one gameId the shared game-state poll is keyed on: the active
 * lobby game, or — once no game is active — the last game this perspective
 * completed, recovered from sessionStorage so a reload still shows its
 * results. Every consumer of the shared poll (action/paradox/knowledge/
 * results) sees the same resolved id.
 */
export function useEffectiveGameId(gameId: string | null, perspectiveKey: string | null): string | null {
  const effectiveGameId = useMemo(() => {
    if (gameId) {
      return gameId
    }
    return readStoredGameId(perspectiveKey)
  }, [gameId, perspectiveKey])

  useEffect(() => {
    if (gameId) {
      writeStoredGameId(gameId, perspectiveKey)
    }
  }, [gameId, perspectiveKey])

  return effectiveGameId
}
