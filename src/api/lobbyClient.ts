/**
 * Participant-scoped lobby HTTP client against the adopted session contracts.
 *
 * Every call carries the caller's Bearer credential through the injected
 * authenticated fetch; the server remains authoritative for membership,
 * host/start state and roster rules. Clients branch on stable problem
 * `code` values (`<status>-<nn>`), never on free-text `detail`.
 */

export type LobbyStatus = 'WAITING' | 'STARTED' | 'CLOSED';

export interface LobbyMember {
  readonly playerId: string;
  readonly playerName: string;
  readonly isHost: boolean;
}

export interface LobbyView {
  readonly lobbyId: string;
  readonly gameId: string;
  readonly hostPlayerId: string;
  readonly status: LobbyStatus;
  readonly members: readonly LobbyMember[];
}

export interface CreateLobbyResult {
  readonly lobbyId: string;
  readonly hostPlayerId: string;
  readonly joinCode: string;
}

export interface JoinLobbyResult {
  readonly lobbyId: string;
  readonly playerId: string;
  readonly currentPlayers: readonly LobbyMember[];
}

export interface StartGameResult {
  readonly gameId: string;
}

export type GameStatus = 'IN_PROGRESS' | 'GAME_ENDED';

export interface GameSummary {
  readonly gameId: string;
  readonly status: GameStatus;
  readonly eraNumber: number;
  readonly playerCount: number;
  readonly cascadedParadoxCount: number;
}

export type AuthenticatedFetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class LobbyApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly disconnectedPlayerIds: readonly string[] | null;

  constructor(
    status: number,
    code: string | null,
    detail: string,
    disconnectedPlayerIds: readonly string[] | null = null,
  ) {
    super(detail);
    this.name = 'LobbyApiError';
    this.status = status;
    this.code = code;
    this.disconnectedPlayerIds = disconnectedPlayerIds;
  }

  isCode(code: string): boolean {
    return this.code === code;
  }
}

function lobbyUrl(apiBaseUrl: string, path: string): string {
  const normalized = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  return `${normalized}${path}`;
}

async function readJsonSafe(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const ids = value.filter((entry): entry is string => typeof entry === 'string');
  return ids.length === value.length ? ids : null;
}

async function throwProblem(response: Response, fallback: string): Promise<never> {
  const body = await readJsonSafe(response);
  const code = body ? stringField(body['code']) : null;
  const detail = body ? (stringField(body['detail']) ?? fallback) : fallback;
  const disconnected = body ? (stringArray(body['disconnectedPlayerIds']) ?? null) : null;
  throw new LobbyApiError(response.status, code, detail, disconnected);
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Lobby response is missing ${name}.`);
  }
  return value;
}

/**
 * Maps stable problem codes to player-safe messages. Unknown codes fall
 * back to the server detail so authoritative errors are shown, never
 * invented membership.
 */
export function lobbyErrorMessage(error: unknown): string {
  if (error instanceof LobbyApiError) {
    switch (error.code) {
      case '404-01':
        return 'Lobby not found. Check the invitation link and try again.';
      case '403-01':
        return 'You are not a member of this lobby. Join with a valid invitation to see its membership.';
      case '404-02':
        return 'Game not found, or you are not a participant of it.';
      case '404-03':
        return 'You are not in this lobby.';
      case '409-01':
        return 'This lobby already started. Ask the host for the active game instead of joining.';
      case '409-02':
        return 'You already joined this lobby. Refreshing your membership instead of joining again.';
      case '422-01':
        return 'This lobby is full (5 players maximum).';
      case '403-02':
        return 'Only the lobby host can start the game.';
      case '409-03': {
        const count = error.disconnectedPlayerIds?.length ?? 0;
        if (count === 0) {
          return 'Cannot start while players are disconnected. Reconnect them and try again.';
        }
        const playerNoun = count === 1 ? 'player is' : 'players are';
        return `Cannot start while ${count} ${playerNoun} disconnected. Reconnect them and try again.`;
      }
      case '422-02':
        return 'Starting needs 3 to 5 players. Invite more players before starting.';
      default:
        break;
    }
    if (error.status === 401) {
      return 'Your session expired. Sign in again to continue.';
    }
    if (error.status === 429) {
      return 'Too many requests. Wait a moment and try again.';
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

async function postJson<T>(
  fetchFn: AuthenticatedFetchFn,
  url: string,
  body: Record<string, string>,
  parse: (json: Record<string, unknown>) => T,
  action: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Could not reach the game server to ${action}. Check your connection and try again.`);
  }
  if (!response.ok) {
    await throwProblem(response, `Could not ${action}. Try again.`);
  }
  const json = await readJsonSafe(response);
  if (!json) {
    throw new Error(`The server answered without ${action} state. Refresh and try again.`);
  }
  return parse(json);
}

async function getJson<T>(
  fetchFn: AuthenticatedFetchFn,
  url: string,
  action: string,
  parse: (json: Record<string, unknown>) => T,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error(`Could not reach the game server to ${action}. Check your connection and try again.`);
  }
  if (!response.ok) {
    await throwProblem(response, `Could not ${action}. Try again.`);
  }
  const json = await readJsonSafe(response);
  if (!json) {
    throw new Error(`The server answered without ${action} state. Refresh and try again.`);
  }
  return parse(json);
}

function parseMember(value: unknown): LobbyMember {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Lobby response is missing member state.');
  }
  const member = value as Record<string, unknown>;
  const isHost = member['isHost'];
  if (typeof isHost !== 'boolean') {
    throw new TypeError('Lobby response is missing member state.');
  }
  return {
    playerId: requireString(member['playerId'], 'member playerId'),
    playerName: requireString(member['playerName'], 'member playerName'),
    isHost,
  };
}

function parseMembers(value: unknown): readonly LobbyMember[] {
  if (!Array.isArray(value)) {
    throw new TypeError('Lobby response is missing membership.');
  }
  return value.map(parseMember);
}

function parseLobbyView(json: Record<string, unknown>): LobbyView {
  const status = json['status'];
  if (status !== 'WAITING' && status !== 'STARTED' && status !== 'CLOSED') {
    throw new Error('Lobby response carries an unknown readiness state.');
  }
  return {
    lobbyId: requireString(json['lobbyId'], 'lobbyId'),
    gameId: requireString(json['gameId'], 'game identity'),
    hostPlayerId: requireString(json['hostPlayerId'], 'host'),
    status,
    members: parseMembers(json['members']),
  };
}

/** Creates a lobby; the creator becomes host. */
export function createLobby(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  playerName: string,
): Promise<CreateLobbyResult> {
  const name = playerName.trim();
  if (!name) {
    return Promise.reject(new Error('Enter a player name to create a lobby.'));
  }
  return postJson(fetchFn, lobbyUrl(apiBaseUrl, '/api/v1/lobbies'), { playerName: name }, (json) => ({
    lobbyId: requireString(json['lobbyId'], 'lobbyId'),
    hostPlayerId: requireString(json['hostPlayerId'], 'host'),
    joinCode: requireString(json['joinCode'], 'invitation code'),
  }), 'create a lobby');
}

/** Recovers authoritative membership/host/start state; the reload-safe read. */
export function getLobby(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  lobbyId: string,
): Promise<LobbyView> {
  if (!lobbyId.trim()) {
    return Promise.reject(new Error('A lobby reference is needed to refresh membership.'));
  }
  return getJson(
    fetchFn,
    lobbyUrl(apiBaseUrl, `/api/v1/lobbies/${encodeURIComponent(lobbyId)}`),
    'refresh the lobby',
    parseLobbyView,
  );
}

/** Joins a lobby. A `409-02` means the membership already landed: reconcile. */
export function joinLobby(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  lobbyId: string,
  playerName: string,
): Promise<JoinLobbyResult> {
  const name = playerName.trim();
  if (!lobbyId.trim()) {
    return Promise.reject(new Error('A lobby reference is needed to join.'));
  }
  if (!name) {
    return Promise.reject(new Error('Enter a player name to join the lobby.'));
  }
  return postJson(
    fetchFn,
    lobbyUrl(apiBaseUrl, `/api/v1/lobbies/${encodeURIComponent(lobbyId)}/join`),
    { playerName: name },
    (json) => ({
      lobbyId: requireString(json['lobbyId'], 'lobbyId'),
      playerId: requireString(json['playerId'], 'player identity'),
      currentPlayers: parseMembers(json['currentPlayers']),
    }),
    'join the lobby',
  );
}

/** Leaves a lobby. */
export async function leaveLobby(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  lobbyId: string,
): Promise<void> {
  if (!lobbyId.trim()) {
    throw new Error('A lobby reference is needed to leave.');
  }
  let response: Response;
  try {
    response = await fetchFn(lobbyUrl(apiBaseUrl, `/api/v1/lobbies/${encodeURIComponent(lobbyId)}/players/me`), {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('Could not reach the game server to leave the lobby. Check your connection and try again.');
  }
  if (!response.ok) {
    await throwProblem(response, 'Could not leave the lobby. Try again.');
  }
}

/** Starts the game; host-only with an adopted 3-5 roster. */
export function startGame(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  lobbyId: string,
): Promise<StartGameResult> {
  if (!lobbyId.trim()) {
    return Promise.reject(new Error('A lobby reference is needed to start.'));
  }
  return postJson(
    fetchFn,
    lobbyUrl(apiBaseUrl, `/api/v1/lobbies/${encodeURIComponent(lobbyId)}/start`),
    {},
    (json) => ({ gameId: requireString(json['gameId'], 'game identity') }),
    'start the game',
  );
}

/** Reads the public game summary once a lobby started. */
export function getGame(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  gameId: string,
): Promise<GameSummary> {
  if (!gameId.trim()) {
    return Promise.reject(new Error('A game reference is needed to read its state.'));
  }
  return getJson(
    fetchFn,
    lobbyUrl(apiBaseUrl, `/api/v1/games/${encodeURIComponent(gameId)}`),
    'read the game',
    (json) => {
      const status = json['status'];
      if (status !== 'IN_PROGRESS' && status !== 'GAME_ENDED') {
        throw new Error('Game response carries an unknown status.');
      }
      const eraNumber = json['eraNumber'];
      const playerCount = json['playerCount'];
      const cascaded = json['cascadedParadoxCount'];
      if (typeof eraNumber !== 'number' || typeof playerCount !== 'number' || typeof cascaded !== 'number') {
        throw new TypeError('Game response is missing game state.');
      }
      return {
        gameId: requireString(json['gameId'], 'game identity'),
        status,
        eraNumber,
        playerCount,
        cascadedParadoxCount: cascaded,
      };
    },
  );
}
