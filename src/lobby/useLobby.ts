import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LobbyApiError,
  createLobby as apiCreateLobby,
  getLobby as apiGetLobby,
  joinLobby as apiJoinLobby,
  leaveLobby as apiLeaveLobby,
  lobbyErrorMessage,
  startGame as apiStartGame,
} from '../api/lobbyClient'
import type { AuthenticatedFetchFn, LobbyView } from '../api/lobbyClient'
import { parseLobbyReference } from '../auth/invitation'

export type LobbyPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'working'; readonly action: 'creating' | 'joining' | 'loading' | 'starting' | 'leaving' }
  | { readonly kind: 'ready' }
  | { readonly kind: 'failed'; readonly message: string; readonly code: string | null };

export interface LobbySessionState {
  readonly phase: LobbyPhase;
  readonly lobby: LobbyView | null;
  readonly ownPlayerId: string | null;
  readonly lastGameId: string | null;
  readonly isHost: boolean;
  readonly canStart: boolean;
}

export interface UseLobbyOptions {
  readonly apiBaseUrl: string;
  readonly fetchFn: AuthenticatedFetchFn;
  readonly initialLobbyId: string | null;
  readonly pollWhileWaitingMs?: number;
  readonly onLobbyIdChange?: (lobbyId: string | null) => void;
}

const LOBBY_STORAGE_KEY = 'temporal-rift.private.lobbyId';
const OWN_PLAYER_STORAGE_KEY = 'temporal-rift.private.playerId';

function readStored(key: string): string | null {
  try {
    const value = sessionStorage.getItem(key);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null): void {
  try {
    if (value) {
      sessionStorage.setItem(key, value);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Reload recovery is best-effort; authoritative state stays server-side.
  }
}

/**
 * Owns recoverable lobby membership against the authoritative session
 * contracts. Lost join/start responses never retry blindly: the hook
 * refreshes with `GET /lobbies/{id}` first and treats `409-02` as
 * "already joined, reconcile" rather than a duplicate join.
 */
export function useLobby(options: UseLobbyOptions) {
  const { apiBaseUrl, fetchFn, initialLobbyId, pollWhileWaitingMs = 5000, onLobbyIdChange } = options;
  const [state, setState] = useState<LobbySessionState>({
    phase: initialLobbyId ? { kind: 'working', action: 'loading' } : { kind: 'idle' },
    lobby: null,
    ownPlayerId: readStored(OWN_PLAYER_STORAGE_KEY),
    lastGameId: null,
    isHost: false,
    canStart: false,
  });
  const stateRef = useRef(state);
  const fetchRef = useRef(fetchFn);
  const lobbyIdRef = useRef<string | null>(initialLobbyId ?? readStored(LOBBY_STORAGE_KEY));
  const onLobbyIdChangeRef = useRef(onLobbyIdChange);
  const generationRef = useRef(0);
  const commandInFlightRef = useRef(false);
  const pollDelayRef = useRef(pollWhileWaitingMs);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);
  useEffect(() => {
    onLobbyIdChangeRef.current = onLobbyIdChange;
  }, [onLobbyIdChange]);

  const setLobbyId = useCallback((lobbyId: string | null) => {
    lobbyIdRef.current = lobbyId;
    writeStored(LOBBY_STORAGE_KEY, lobbyId);
    onLobbyIdChangeRef.current?.(lobbyId);
  }, []);

  const confirmedOwnPlayerId = useCallback((view: LobbyView, knownOwnPlayerId: string | null): string | null => {
    const candidate = view.currentPlayerId ?? knownOwnPlayerId;
    return candidate && view.members.some((member) => member.playerId === candidate) ? candidate : null;
  }, []);

  const applyLobby = useCallback(
    (lobby: LobbyView, ownPlayerId: string | null, lastGameId: string | null = null) => {
      const isHost = ownPlayerId !== null && lobby.hostPlayerId === ownPlayerId;
      const memberCount = lobby.members.length;
      setState({
        phase: { kind: 'ready' },
        lobby,
        ownPlayerId,
        lastGameId: lastGameId ?? (lobby.status === 'STARTED' ? lobby.gameId : null),
        isHost,
        canStart: isHost && lobby.status === 'WAITING' && memberCount >= 3 && memberCount <= 5,
      });
    },
    [],
  );

  const refresh = useCallback(async (background = false): Promise<LobbyView | null> => {
    const lobbyId = lobbyIdRef.current;
    if (!lobbyId) {
      return null;
    }
    const generation = generationRef.current;
    try {
      const view = await apiGetLobby(fetchRef.current, apiBaseUrl, lobbyId);
      if (generation !== generationRef.current || commandInFlightRef.current || lobbyId !== lobbyIdRef.current) {
        return null;
      }
      const knownOwn = confirmedOwnPlayerId(view, stateRef.current.ownPlayerId);
      if (!knownOwn) {
        // No confirmed membership in the authoritative view: don't show a
        // member view for a lobby we can't prove we're part of. The lobby
        // reference (and its invitation URL) stays intact so a join still
        // has a target.
        writeStored(OWN_PLAYER_STORAGE_KEY, null);
        setState({ phase: { kind: 'idle' }, lobby: null, ownPlayerId: null, lastGameId: null, isHost: false, canStart: false });
        return null;
      }
      applyLobby(view, knownOwn);
      return view;
    } catch (error) {
      const code = error instanceof LobbyApiError ? error.code : null;
      // A deleted/unknown lobby must not pin the client to a dead reference.
      if (code === '404-01') {
        setLobbyId(null);
        writeStored(OWN_PLAYER_STORAGE_KEY, null);
        setState((previous) => ({
          ...previous,
          phase: { kind: 'failed', message: lobbyErrorMessage(error), code },
          lobby: null,
          ownPlayerId: null,
          isHost: false,
          canStart: false,
        }));
        return null;
      }
      if (!background) {
        setState((previous) => ({
          ...previous,
          phase: { kind: 'failed', message: lobbyErrorMessage(error), code },
        }));
      }
      return previousLobbyOnFailure();
    }

    function previousLobbyOnFailure(): null {
      return null;
    }
  }, [apiBaseUrl, applyLobby, confirmedOwnPlayerId, setLobbyId]);

  // Initial reload recovery: authoritative GET wins over cached references.
  useEffect(() => {
    if (!lobbyIdRef.current) {
      return;
    }
    let cancelled = false;
    const lobbyId = lobbyIdRef.current;
    const generation = generationRef.current;
    void (async () => {
      try {
        const view = await apiGetLobby(fetchRef.current, apiBaseUrl, lobbyId);
        if (cancelled || generation !== generationRef.current || commandInFlightRef.current || lobbyId !== lobbyIdRef.current) {
          return;
        }
        const knownOwn = confirmedOwnPlayerId(view, readStored(OWN_PLAYER_STORAGE_KEY));
        if (!knownOwn) {
          // Invited or stale reference with no confirmed membership: show
          // the join view rather than a member view we can't back up. Keep
          // the lobby reference (and its invitation URL) so the join view
          // can still target it.
          writeStored(OWN_PLAYER_STORAGE_KEY, null);
          setState((previous) => ({ ...previous, phase: { kind: 'idle' }, lobby: null, ownPlayerId: null }));
          return;
        }
        applyLobby(view, knownOwn);
      } catch (error) {
        if (cancelled || generation !== generationRef.current || commandInFlightRef.current || lobbyId !== lobbyIdRef.current) {
          return;
        }
        const code = error instanceof LobbyApiError ? error.code : null;
        if (code === '404-01' || code === '403-01') {
          setLobbyId(null);
          writeStored(OWN_PLAYER_STORAGE_KEY, null);
          setState((previous) => ({ ...previous, phase: { kind: 'idle' }, lobby: null, ownPlayerId: null }));
          return;
        }
        setState((previous) => ({
          ...previous,
          phase: { kind: 'failed', message: lobbyErrorMessage(error), code },
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, applyLobby, confirmedOwnPlayerId, setLobbyId]);

  // While waiting, retry authoritative reads with capped backoff so a brief
  // connection loss cannot disable recovery.
  useEffect(() => {
    if (state.phase.kind !== 'ready' || state.lobby?.status !== 'WAITING') {
      return;
    }
    if (pollWhileWaitingMs <= 0) {
      return;
    }
    let cancelled = false;
    let timer: number | null = null;
    pollDelayRef.current = pollWhileWaitingMs;
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        void (async () => {
          const view = await refresh(true);
          if (cancelled || stateRef.current.phase.kind !== 'ready' || stateRef.current.lobby?.lobbyId !== state.lobby?.lobbyId) {
            return;
          }
          pollDelayRef.current = view ? pollWhileWaitingMs : Math.min(pollDelayRef.current * 2, 30_000);
          schedule(pollDelayRef.current);
        })();
      }, delay);
    };
    schedule(pollDelayRef.current);
    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [state.phase.kind, state.lobby?.status, state.lobby?.lobbyId, pollWhileWaitingMs, refresh]);

  const create = useCallback(
    async (playerName: string): Promise<void> => {
      const generation = ++generationRef.current;
      commandInFlightRef.current = true;
      let createdLobbyId: string | null = null;
      setState((previous) => ({ ...previous, phase: { kind: 'working', action: 'creating' } }));
      try {
        const created = await apiCreateLobby(fetchRef.current, apiBaseUrl, playerName);
        if (generation !== generationRef.current) {
          return;
        }
        createdLobbyId = created.lobbyId;
        setLobbyId(created.lobbyId);
        writeStored(OWN_PLAYER_STORAGE_KEY, created.hostPlayerId);
        setState((previous) => ({ ...previous, ownPlayerId: created.hostPlayerId }));
        const view = await apiGetLobby(fetchRef.current, apiBaseUrl, created.lobbyId);
        if (generation !== generationRef.current || lobbyIdRef.current !== created.lobbyId) {
          return;
        }
        applyLobby(view, created.hostPlayerId);
      } catch (error) {
        if (generation !== generationRef.current) {
          return;
        }
        // The create may have succeeded even when its confirmation read did
        // not. Keep its server-issued identifiers and retry the safe read.
        if (createdLobbyId) {
          setState((previous) => ({ ...previous, phase: { kind: 'working', action: 'loading' } }));
          const retryCreatedRead = async (delay: number): Promise<void> => {
            const recovered = await refresh(true);
            if (recovered || generation !== generationRef.current || lobbyIdRef.current !== createdLobbyId) {
              return;
            }
            window.setTimeout(() => void retryCreatedRead(Math.min(delay * 2, 30_000)), delay);
          };
          window.setTimeout(() => void retryCreatedRead(pollWhileWaitingMs), pollWhileWaitingMs);
        } else {
          setState((previous) => ({
            ...previous,
            phase: {
              kind: 'failed',
              message: lobbyErrorMessage(error),
              code: error instanceof LobbyApiError ? error.code : null,
            },
          }));
        }
      } finally {
        if (generation === generationRef.current) {
          commandInFlightRef.current = false;
        }
      }
    },
    [apiBaseUrl, applyLobby, pollWhileWaitingMs, refresh, setLobbyId],
  );

  // Reconciles a join against the lobby actually being joined (never a
  // stale prior reference) when the join response itself was lost or
  // already landed. Never infers identity from playerName: a display name
  // is not unique, so only a confirmed own-player-id counts as membership.
  // Returns whether membership was confirmed.
  const reconcileJoin = useCallback(
    async (target: string): Promise<boolean> => {
      try {
        const view = await apiGetLobby(fetchRef.current, apiBaseUrl, target);
        const reconciledOwn = confirmedOwnPlayerId(view, readStored(OWN_PLAYER_STORAGE_KEY));
        if (!reconciledOwn) {
          return false;
        }
        setLobbyId(target);
        writeStored(OWN_PLAYER_STORAGE_KEY, reconciledOwn);
        applyLobby(view, reconciledOwn);
        return true;
      } catch {
        return false;
      }
    },
    [apiBaseUrl, applyLobby, confirmedOwnPlayerId, setLobbyId],
  );

  const join = useCallback(
    async (lobbyId: string, playerName: string): Promise<void> => {
      const invitation = parseLobbyReference(lobbyId);
      if (!invitation) {
        setState((previous) => ({
          ...previous,
          phase: { kind: 'failed', message: 'Enter a valid invitation URL or lobby reference to join.', code: null },
        }));
        return;
      }
      const target = invitation.lobbyId;
      const generation = ++generationRef.current;
      commandInFlightRef.current = true;
      setState((previous) => ({ ...previous, phase: { kind: 'working', action: 'joining' } }));
      try {
        const joined = await apiJoinLobby(fetchRef.current, apiBaseUrl, target, playerName);
        if (generation !== generationRef.current) {
          return;
        }
        setLobbyId(joined.lobbyId);
        writeStored(OWN_PLAYER_STORAGE_KEY, joined.playerId);
        // Authoritative membership wins over the join echo.
        const view = await apiGetLobby(fetchRef.current, apiBaseUrl, joined.lobbyId);
        if (generation !== generationRef.current || lobbyIdRef.current !== joined.lobbyId) {
          return;
        }
        applyLobby(view, joined.playerId);
      } catch (error) {
        // A 409-02 (already joined) or a lost response for the lobby being
        // targeted may both mean the join actually landed: reconcile
        // against `target` itself rather than a stale prior reference.
        const shouldReconcile = (error instanceof LobbyApiError && error.code === '409-02') || !(error instanceof LobbyApiError);
        if (shouldReconcile && (await reconcileJoin(target))) {
          return;
        }
        const cannotConfirmExistingMembership = error instanceof LobbyApiError && error.code === '409-02';
        setState((previous) => ({
          ...previous,
          phase: {
            kind: 'failed',
            message: cannotConfirmExistingMembership
              ? 'The server reports that you already joined, but membership could not be confirmed. Reopen a valid invitation after the connection recovers.'
              : lobbyErrorMessage(error),
            code: error instanceof LobbyApiError ? error.code : null,
          },
        }));
      } finally {
        if (generation === generationRef.current) {
          commandInFlightRef.current = false;
        }
      }
    },
    [apiBaseUrl, applyLobby, reconcileJoin, setLobbyId],
  );

  const leave = useCallback(async (): Promise<void> => {
    const lobbyId = lobbyIdRef.current;
    if (!lobbyId) {
      return;
    }
    const generation = ++generationRef.current;
    commandInFlightRef.current = true;
    setState((previous) => ({ ...previous, phase: { kind: 'working', action: 'leaving' } }));
    try {
      await apiLeaveLobby(fetchRef.current, apiBaseUrl, lobbyId);
    } catch (error) {
      // Leaving a missing lobby still clears the local reference.
      if (!(error instanceof LobbyApiError && error.code === '404-01')) {
        setState((previous) => ({
          ...previous,
          phase: {
            kind: 'failed',
            message: lobbyErrorMessage(error),
            code: error instanceof LobbyApiError ? error.code : null,
          },
        }));
        commandInFlightRef.current = false;
        return;
      }
    }
    if (generation !== generationRef.current) {
      return;
    }
    setLobbyId(null);
    writeStored(OWN_PLAYER_STORAGE_KEY, null);
    setState({ phase: { kind: 'idle' }, lobby: null, ownPlayerId: null, lastGameId: null, isHost: false, canStart: false });
    commandInFlightRef.current = false;
  }, [apiBaseUrl, setLobbyId]);

  const start = useCallback(async (): Promise<void> => {
    const lobbyId = lobbyIdRef.current;
    if (!lobbyId) {
      return;
    }
    const generation = ++generationRef.current;
    commandInFlightRef.current = true;
    setState((previous) => ({ ...previous, phase: { kind: 'working', action: 'starting' } }));
    try {
      const started = await apiStartGame(fetchRef.current, apiBaseUrl, lobbyId);
      const view = await apiGetLobby(fetchRef.current, apiBaseUrl, lobbyId);
      if (generation !== generationRef.current || lobbyId !== lobbyIdRef.current) {
        return;
      }
      applyLobby(view, stateRef.current.ownPlayerId, started.gameId);
    } catch (error) {
      if (!(error instanceof LobbyApiError)) {
        // A lost start response may still have started the lobby.
        commandInFlightRef.current = false;
        const reconciled = await refresh();
        commandInFlightRef.current = true;
        if (reconciled?.status === 'STARTED') {
          return;
        }
      }
      setState((previous) => ({
        ...previous,
        phase: {
          kind: 'failed',
          message: lobbyErrorMessage(error),
          code: error instanceof LobbyApiError ? error.code : null,
        },
      }));
    } finally {
      if (generation === generationRef.current) {
        commandInFlightRef.current = false;
      }
    }
  }, [apiBaseUrl, applyLobby, refresh]);

  const dismissError = useCallback(() => {
    setState((previous) => ({
      ...previous,
      phase: previous.lobby ? { kind: 'ready' } : { kind: 'idle' },
    }));
  }, []);

  return useMemo(
    () => ({ state, create, join, leave, start, refresh, dismissError }),
    [state, create, join, leave, start, refresh, dismissError],
  );
}

export type LobbySession = ReturnType<typeof useLobby>;
