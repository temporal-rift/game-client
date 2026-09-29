import { createContext, useContext, type ReactNode } from 'react'
import type { AppConfig } from '../config/appConfig'
import type { AuthenticatedFetchFn } from '../api/client'
import type { AuthSession } from '../auth/session'
import type { LobbySession } from '../lobby/useLobby'

/** What every page of the signed-in app shares: the session, its API access and its lobby. */
export interface SignedInSession {
  readonly config: AppConfig
  readonly fetchFn: AuthenticatedFetchFn
  readonly authSession: AuthSession
  readonly lobby: LobbySession
  readonly renderSessionBar: (faction: string | null) => ReactNode
}

export const SignedInContext = createContext<SignedInSession | null>(null)

export function useSignedIn(): SignedInSession {
  const session = useContext(SignedInContext)
  if (!session) {
    throw new Error('Signed-in pages render only under a signed-in session.')
  }
  return session
}
