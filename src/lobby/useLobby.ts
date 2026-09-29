import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiProblemError } from '../api/client'
import { lobbyQuery, queryKeys } from '../api/queries'
import {
  createLobby as apiCreateLobby,
  joinLobby as apiJoinLobby,
  leaveLobby as apiLeaveLobby,
  lobbyErrorMessage,
  startGame as apiStartGame,
} from '../api/session'
import type { AuthenticatedFetchFn, LobbyResponse } from '../api/session'
import { parseLobbyReference } from '../auth/invitation'
import { backoffDelayMs } from '../game/reconciliation'

export type LobbyPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'working'; readonly action: 'creating' | 'joining' | 'loading' | 'starting' | 'leaving' }
  | { readonly kind: 'ready' }
  | { readonly kind: 'failed'; readonly message: string; readonly code: string | null }

export interface LobbySessionState {
  readonly phase: LobbyPhase
  readonly lobby: LobbyResponse | null
  readonly ownPlayerId: string | null
  readonly lastGameId: string | null
  readonly isHost: boolean
  readonly canStart: boolean
}

export interface UseLobbyOptions {
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
  /** The viewer's identity subject: cached lobby state is scoped to it. */
  readonly perspectiveKey: string
  readonly initialLobbyId: string | null
  readonly pollWhileWaitingMs?: number
  readonly onLobbyIdChange?: (lobbyId: string | null) => void
}

interface Failure {
  readonly message: string
  readonly code: string | null
}

const LOBBY_STORAGE_KEY = 'temporal-rift.private.lobbyId'
const OWN_PLAYER_STORAGE_KEY = 'temporal-rift.private.playerId'
const MAX_POLL_INTERVAL_MS = 30_000

const UNCONFIRMED_JOIN_MESSAGE =
  'The server reports that you already joined, but membership could not be confirmed. Reopen a valid invitation after the connection recovers.'

function readStored(key: string): string | null {
  try {
    const value = sessionStorage.getItem(key)
    return value && value.length > 0 ? value : null
  } catch {
    return null
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value) {
      sessionStorage.setItem(key, value)
    } else {
      sessionStorage.removeItem(key)
    }
  } catch {
    // Reload recovery is best-effort; authoritative state stays server-side.
  }
}

function problemCode(error: unknown): string | null {
  return error instanceof ApiProblemError ? error.code : null
}

function failureOf(error: unknown): Failure {
  return { message: lobbyErrorMessage(error), code: problemCode(error) }
}

/** Membership counts only when the authoritative view names the caller among its members. */
function confirmedOwnPlayerId(view: LobbyResponse, knownOwnPlayerId: string | null): string | null {
  const candidate = view.currentPlayerId ?? knownOwnPlayerId
  return candidate && view.members.some((member) => member.playerId === candidate) ? candidate : null
}

/**
 * Owns recoverable lobby membership against the authoritative session
 * contracts. The lobby is a query (polled while waiting, backing off on
 * failure); create, join, start and leave are mutations that never retry
 * blindly: a lost join or start response is reconciled with
 * `GET /lobbies/{id}` first, and `409-02` means "already joined, reconcile"
 * rather than a duplicate join.
 */
export function useLobby(options: UseLobbyOptions) {
  const { apiBaseUrl, fetchFn, perspectiveKey, initialLobbyId, pollWhileWaitingMs = 5000, onLobbyIdChange } = options
  const queryClient = useQueryClient()
  const scope = useMemo(() => ({ perspective: perspectiveKey, apiBaseUrl, fetchFn }), [perspectiveKey, apiBaseUrl, fetchFn])

  // The routed lobby (its page or an invitation) stays the join target even while the
  // server hides it from a non-member; a lobby remembered from an earlier visit does not.
  const [routedLobbyId] = useState(initialLobbyId)
  const [lobbyId, setLobbyIdState] = useState(() => initialLobbyId ?? readStored(LOBBY_STORAGE_KEY))
  const [knownOwnPlayerId, setKnownOwnPlayerIdState] = useState(() => readStored(OWN_PLAYER_STORAGE_KEY))
  const [started, setStarted] = useState<{ readonly lobbyId: string; readonly gameId: string } | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  // A dismissed recovery failure stays dismissed for its lobby: every retry reports a new error object.
  const [dismissedRecoveryFor, setDismissedRecoveryFor] = useState<string | null>(null)

  const setLobbyId = useCallback(
    (next: string | null) => {
      setLobbyIdState(next)
      writeStored(LOBBY_STORAGE_KEY, next)
      onLobbyIdChange?.(next)
    },
    [onLobbyIdChange],
  )

  const setKnownOwnPlayerId = useCallback((next: string | null) => {
    setKnownOwnPlayerIdState(next)
    writeStored(OWN_PLAYER_STORAGE_KEY, next)
  }, [])

  const forgetLobby = useCallback(() => {
    setLobbyId(null)
    setKnownOwnPlayerId(null)
    setStarted(null)
  }, [setLobbyId, setKnownOwnPlayerId])

  // A deleted lobby, or one the server now hides from a player who was not invited to it,
  // must not pin the client to a dead reference: it is read no more.
  const isGone = (error: unknown) =>
    problemCode(error) === '404-01' || (problemCode(error) === '403-01' && lobbyId !== routedLobbyId)

  const query = useQuery({
    ...lobbyQuery(scope, lobbyId ?? ''),
    enabled: (current) => lobbyId !== null && !isGone(current.state.error),
    // While waiting, poll the authoritative read; a failing read retries with capped backoff,
    // except for the answers that mean the lobby is gone or hidden.
    refetchInterval: (current) =>
      pollWhileWaitingMs > 0 && current.state.data?.status === 'WAITING' ? pollWhileWaitingMs : false,
    retry: (_failureCount, error) => pollWhileWaitingMs > 0 && problemCode(error) !== '404-01' && problemCode(error) !== '403-01',
    retryDelay: (failureCount) => backoffDelayMs(failureCount + 1, { baseDelayMs: pollWhileWaitingMs, maxDelayMs: MAX_POLL_INTERVAL_MS }),
  })

  // A gone lobby stops being the active one, and the remembered reference (and the page
  // showing it) is let go.
  const invitedButHidden = problemCode(query.error) === '403-01' && lobbyId === routedLobbyId
  const lobbyGone = lobbyId !== null && isGone(query.error)
  const activeLobbyId = lobbyGone ? null : lobbyId
  useEffect(() => {
    if (lobbyGone) {
      writeStored(LOBBY_STORAGE_KEY, null)
      writeStored(OWN_PLAYER_STORAGE_KEY, null)
      onLobbyIdChange?.(null)
    }
  }, [lobbyGone, onLobbyIdChange])

  const view = activeLobbyId !== null && !invitedButHidden ? (query.data ?? null) : null
  const ownPlayerId = view ? confirmedOwnPlayerId(view, knownOwnPlayerId) : null
  const memberView = ownPlayerId ? view : null

  /** Reads a lobby now and reports whether it confirms the caller's membership. */
  const readMembership = useCallback(
    async (target: string): Promise<string | null> => {
      try {
        const fresh = await queryClient.fetchQuery(lobbyQuery(scope, target))
        return confirmedOwnPlayerId(fresh, knownOwnPlayerId)
      } catch {
        return null
      }
    },
    [queryClient, scope, knownOwnPlayerId],
  )

  const { mutateAsync: createLobby, isPending: createPending } = useMutation({
    mutationFn: (playerName: string) => apiCreateLobby(fetchFn, apiBaseUrl, playerName),
    onSuccess: async (created) => {
      setKnownOwnPlayerId(created.hostPlayerId)
      setStarted(null)
      setLobbyId(created.lobbyId)
      // The create may have succeeded even when this read does not: the lobby query keeps
      // retrying the safe read with the server-issued identifiers.
      await queryClient.prefetchQuery(lobbyQuery(scope, created.lobbyId))
    },
    onError: (error) => setFailure(failureOf(error)),
  })

  const { mutateAsync: joinLobby, isPending: joinPending } = useMutation({
    mutationFn: ({ target, playerName }: { readonly target: string; readonly playerName: string }) =>
      apiJoinLobby(fetchFn, apiBaseUrl, target, playerName),
    onSuccess: async (joined) => {
      setKnownOwnPlayerId(joined.playerId)
      setStarted(null)
      setLobbyId(joined.lobbyId)
      // Authoritative membership wins over the join echo.
      await queryClient.prefetchQuery(lobbyQuery(scope, joined.lobbyId))
    },
    // A 409-02 (already joined) or a lost response may both mean the join landed: reconcile
    // against the lobby actually being joined, never a stale prior reference. Identity is
    // never inferred from a display name: only a confirmed own player id counts.
    onError: async (error, { target }) => {
      const alreadyJoined = problemCode(error) === '409-02'
      if (alreadyJoined || !(error instanceof ApiProblemError)) {
        const confirmed = await readMembership(target)
        if (confirmed) {
          setKnownOwnPlayerId(confirmed)
          setLobbyId(target)
          return
        }
      }
      setFailure(alreadyJoined ? { message: UNCONFIRMED_JOIN_MESSAGE, code: '409-02' } : failureOf(error))
    },
  })

  const { mutateAsync: startLobbyGame, isPending: startPending } = useMutation({
    mutationFn: (target: string) => apiStartGame(fetchFn, apiBaseUrl, target),
    onSuccess: async (result, target) => {
      setStarted({ lobbyId: target, gameId: result.gameId })
      await queryClient.prefetchQuery(lobbyQuery(scope, target))
    },
    onError: async (error, target) => {
      if (!(error instanceof ApiProblemError)) {
        // A lost start response may still have started the lobby.
        const fresh = await queryClient.fetchQuery(lobbyQuery(scope, target)).catch(() => null)
        if (fresh?.status === 'STARTED') {
          return
        }
      }
      setFailure(failureOf(error))
    },
  })

  const { mutateAsync: leaveLobby, isPending: leavePending } = useMutation({
    mutationFn: (target: string) => apiLeaveLobby(fetchFn, apiBaseUrl, target),
    onSettled: (_result, error, target) => {
      // Leaving a missing lobby still clears the local reference.
      if (error && problemCode(error) !== '404-01') {
        setFailure(failureOf(error))
        return
      }
      queryClient.removeQueries({ queryKey: queryKeys.lobby(perspectiveKey, target) })
      forgetLobby()
    },
  })

  const create = useCallback(
    async (playerName: string): Promise<void> => {
      setFailure(null)
      await createLobby(playerName).catch(() => undefined)
    },
    [createLobby],
  )

  const join = useCallback(
    async (reference: string, playerName: string): Promise<void> => {
      setFailure(null)
      const invitation = parseLobbyReference(reference)
      if (!invitation) {
        setFailure({ message: 'Enter a valid invitation URL or lobby reference to join.', code: null })
        return
      }
      await joinLobby({ target: invitation.lobbyId, playerName }).catch(() => undefined)
    },
    [joinLobby],
  )

  const start = useCallback(async (): Promise<void> => {
    if (activeLobbyId) {
      setFailure(null)
      await startLobbyGame(activeLobbyId).catch(() => undefined)
    }
  }, [activeLobbyId, startLobbyGame])

  const leave = useCallback(async (): Promise<void> => {
    if (activeLobbyId) {
      setFailure(null)
      await leaveLobby(activeLobbyId).catch(() => undefined)
    }
  }, [activeLobbyId, leaveLobby])

  /** An explicit authoritative read; its failure is reported, unlike a background poll's. */
  const refresh = useCallback(async (): Promise<LobbyResponse | null> => {
    if (!activeLobbyId) {
      return null
    }
    try {
      const fresh = await queryClient.fetchQuery(lobbyQuery(scope, activeLobbyId))
      return confirmedOwnPlayerId(fresh, knownOwnPlayerId) ? fresh : null
    } catch (error) {
      setFailure(failureOf(error))
      return null
    }
  }, [activeLobbyId, queryClient, scope, knownOwnPlayerId])

  // A read that fails before any view arrives is reported (and dismissible); once a view is
  // shown, background poll failures keep it and retry quietly.
  const queryFailure = query.error ?? query.failureReason
  const recovering = activeLobbyId !== null && !invitedButHidden && !view
  // A successful read ends the episode: a later recovery failure is shown again.
  if (view && dismissedRecoveryFor !== null) {
    setDismissedRecoveryFor(null)
  }
  const recoveryFailure = useMemo(
    () => (recovering && queryFailure && dismissedRecoveryFor !== activeLobbyId ? failureOf(queryFailure) : null),
    [recovering, queryFailure, dismissedRecoveryFor, activeLobbyId],
  )

  const dismissError = useCallback(() => {
    setFailure(null)
    setDismissedRecoveryFor(activeLobbyId)
  }, [activeLobbyId])

  const pendingAction = ((): 'creating' | 'joining' | 'starting' | 'leaving' | null => {
    if (createPending) return 'creating'
    if (joinPending) return 'joining'
    if (startPending) return 'starting'
    return leavePending ? 'leaving' : null
  })()
  const loading = recovering && query.isPending

  const phase = useMemo((): LobbyPhase => {
    if (pendingAction) return { kind: 'working', action: pendingAction }
    const shownFailure = failure ?? recoveryFailure
    if (shownFailure) return { kind: 'failed', ...shownFailure }
    // Recovery reads the lobby before anything can be shown for it.
    if (loading) return { kind: 'working', action: 'loading' }
    return memberView ? { kind: 'ready' } : { kind: 'idle' }
  }, [pendingAction, failure, recoveryFailure, loading, memberView])

  const isHost = memberView !== null && memberView.hostPlayerId === ownPlayerId
  const memberCount = memberView?.members.length ?? 0
  const lastGameId =
    (started && started.lobbyId === memberView?.lobbyId ? started.gameId : null) ??
    (memberView?.status === 'STARTED' ? memberView.gameId : null)

  const state = useMemo(
    (): LobbySessionState => ({
      phase,
      lobby: memberView,
      ownPlayerId,
      lastGameId,
      isHost,
      canStart: isHost && memberView?.status === 'WAITING' && memberCount >= 3 && memberCount <= 5,
    }),
    [phase, memberView, ownPlayerId, lastGameId, isHost, memberCount],
  )

  return useMemo(
    () => ({ state, create, join, leave, start, refresh, dismissError }),
    [state, create, join, leave, start, refresh, dismissError],
  )
}

export type LobbySession = ReturnType<typeof useLobby>
