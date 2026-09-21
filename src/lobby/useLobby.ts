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

  const refresh = useCallback(async (): Promise<LobbyView | null> => {
    const lobbyId = lobbyIdRef.current;
    if (!lobbyId) {
      return null;
    }
    try {
      const view = await apiGetLobby(fetchRef.current, apiBaseUrl, lobbyId);
      const knownOwn = stateRef.current.ownPlayerId;
      const inferredOwn =
        knownOwn && view.members.some((member) => member.playerId === knownOwn) ? knownOwn : knownOwn;
      applyLobby(view, inferredOwn);
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
      setState((previous) => ({
        ...previous,
        phase: { kind: 'failed', message: lobbyErrorMessage(error), code },
      }));
      return previousLobbyOnFailure();
    }

    function previousLobbyOnFailure(): null {
      return null;
    }
  }, [apiBaseUrl, applyLobby, setLobbyId]);

  // Initial reload recovery: authoritative GET wins over cached references.
  useEffect(() => {
    if (!lobbyIdRef.current) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const view = await apiGetLobby(fetchRef.current, apiBaseUrl, lobbyIdRef.current as string);
        if (cancelled) {
          return;
        }
        const knownOwn = readStored(OWN_PLAYER_STORAGE_KEY);
        const stillMember = knownOwn && view.members.some((member) => member.playerId === knownOwn);
        applyLobby(view, stillMember ? knownOwn : knownOwn);
      } catch (error) {
        if (cancelled) {
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
  }, [apiBaseUrl, applyLobby, setLobbyId]);

  // While waiting, poll the authoritative view so both sides see joins.
  useEffect(() => {
    if (state.phase.kind !== 'ready' || state.lobby?.status !== 'WAITING') {
      return;
    }
    if (pollWhileWaitingMs <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      void refresh();
    }, pollWhileWaitingMs);
    return () => window.clearInterval(timer);
  }, [state.phase.kind, state.lobby?.status, state.lobby?.lobbyId, pollWhileWaitingMs, refresh]);

  const create = useCallback(
    async (playerName: string): Promise<void> => {
      setState((previous) => ({ ...previous, phase: { kind: 'working', action: 'creating' } }));
      try {
        const created = await apiCreateLobby(fetchRef.current, apiBaseUrl, playerName);
        setLobbyId(created.lobbyId);
        writeStored(OWN_PLAYER_STORAGE_KEY, created.hostPlayerId);
        const view = await apiGetLobby(fetchRef.current, apiBaseUrl, created.lobbyId);
        applyLobby(view, created.hostPlayerId);
      } catch (error) {
        setState((previous) => ({
          ...previous,
          phase: {
            kind: 'failed',
            message: lobbyErrorMessage(error),
            code: error instanceof LobbyApiError ? error.code : null,
          },
        }));
      }
    },
    [apiBaseUrl, applyLobby, setLobbyId],
  );

  const join = useCallback(
    async (lobbyId: string, playerName: string): Promise<void> => {
      const target = lobbyId.trim();
      if (!target) {
        setState((previous) => ({
          ...previous,
          phase: { kind: 'failed', message: 'A lobby reference is needed to join.', code: null },
        }));
        return;
      }
      setState((previous) => ({ ...previous, phase: { kind: 'working', action: 'joining' } }));
      try {
        const joined = await apiJoinLobby(fetchRef.current, apiBaseUrl, target, playerName);
        setLobbyId(joined.lobbyId);
        writeStored(OWN_PLAYER_STORAGE_KEY, joined.playerId);
        // Authoritative membership wins over the join echo.
        const view = await apiGetLobby(fetchRef.current, apiBaseUrl, joined.lobbyId);
        applyLobby(view, joined.playerId);
      } catch (error) {
        if (error instanceof LobbyApiError && error.code === '409-02') {
          // Membership already landed (possibly a lost-response retry):
          // reconcile instead of creating a duplicate join.
          setLobbyId(target);
          try {
            const view = await apiGetLobby(fetchRef.current, apiBaseUrl, target);
            const knownOwn = readStored(OWN_PLAYER_STORAGE_KEY);
            const reconciledOwn =
              knownOwn && view.members.some((member) => member.playerId === knownOwn)
                ? knownOwn
                : (view.members.find((member) => member.playerName === playerName.trim())?.playerId ?? knownOwn);
            if (reconciledOwn) {
              writeStored(OWN_PLAYER_STORAGE_KEY, reconciledOwn);
            }
            applyLobby(view, reconciledOwn);
            return;
          } catch {
            // Fall through to the already-joined notice below.
          }
        }
        // Lost-response safety for other failures when we already have a
        // reference: a fresh GET decides whether the command landed.
        if (!(error instanceof LobbyApiError) && lobbyIdRef.current) {
          const reconciled = await refresh();
          if (reconciled) {
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
      }
    },
    [apiBaseUrl, applyLobby, refresh, setLobbyId],
  );

  const leave = useCallback(async (): Promise<void> => {
    const lobbyId = lobbyIdRef.current;
    if (!lobbyId) {
      return;
    }
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
        return;
      }
    }
    setLobbyId(null);
    writeStored(OWN_PLAYER_STORAGE_KEY, null);
    setState({ phase: { kind: 'idle' }, lobby: null, ownPlayerId: null, lastGameId: null, isHost: false, canStart: false });
  }, [apiBaseUrl, setLobbyId]);

  const start = useCallback(async (): Promise<void> => {
    const lobbyId = lobbyIdRef.current;
    if (!lobbyId) {
      return;
    }
    setState((previous) => ({ ...previous, phase: { kind: 'working', action: 'starting' } }));
    try {
      const started = await apiStartGame(fetchRef.current, apiBaseUrl, lobbyId);
      const view = await apiGetLobby(fetchRef.current, apiBaseUrl, lobbyId);
      applyLobby(view, stateRef.current.ownPlayerId, started.gameId);
    } catch (error) {
      if (!(error instanceof LobbyApiError)) {
        // A lost start response may still have started the lobby.
        const reconciled = await refresh();
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
