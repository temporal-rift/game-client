/**
 * Participant-scoped lobby calls against the pinned `session-api` contract.
 *
 * Every call carries the caller's Bearer credential through the injected
 * authenticated fetch; the server remains authoritative for membership,
 * host/start state and roster rules.
 */

import { apiClientsFor, apiErrorMessage, callApi, type AuthenticatedFetchFn } from './client'
import {
  createLobby as createLobbyCall,
  getLobby as getLobbyCall,
  joinLobby as joinLobbyCall,
  leaveLobby as leaveLobbyCall,
  startGame as startGameCall,
} from './generated/session'
import type {
  CreateLobbyResponse,
  JoinLobbyResponse,
  LobbyResponse,
  StartGameResponse,
} from './generated/session'
import { zCreateLobbyRequest } from './generated/session/zod.gen'

export type { AuthenticatedFetchFn } from './client'
export type { LobbyResponse, LobbyStatus, PlayerInLobby } from './generated/session'

/** The longest player name the contract accepts. */
export const PLAYER_NAME_MAX_LENGTH = zCreateLobbyRequest.shape.playerName.maxLength ?? Number.POSITIVE_INFINITY

function playerNameProblem(name: string, action: string): string | null {
  if (!name) {
    return `Enter a player name to ${action}.`
  }
  if (name.length > PLAYER_NAME_MAX_LENGTH) {
    return `Player names are at most ${PLAYER_NAME_MAX_LENGTH} characters.`
  }
  return null
}

/**
 * Maps stable problem codes to player-safe messages. Unknown codes fall
 * back to the server detail so authoritative errors are shown, never
 * invented membership.
 */
export function lobbyErrorMessage(error: unknown): string {
  return apiErrorMessage(error, (problem) => {
    switch (problem.code) {
      case '404-01':
        return 'Lobby not found. Check the invitation link and try again.'
      case '403-01':
        return 'You are not a member of this lobby. Join with a valid invitation to see its membership.'
      case '404-02':
        return 'Game not found, or you are not a participant of it.'
      case '404-03':
        return 'You are not in this lobby.'
      case '409-01':
        return 'This lobby already started. Ask the host for the active game instead of joining.'
      case '409-02':
        return 'You already joined this lobby. Refreshing your membership instead of joining again.'
      case '422-01':
        return 'This lobby is full (5 players maximum).'
      case '403-02':
        return 'Only the lobby host can start the game.'
      case '409-03': {
        const count = problem.disconnectedPlayerIds?.length ?? 0
        if (count === 0) {
          return 'Cannot start while players are disconnected. Reconnect them and try again.'
        }
        const playerNoun = count === 1 ? 'player is' : 'players are'
        return `Cannot start while ${count} ${playerNoun} disconnected. Reconnect them and try again.`
      }
      case '422-02':
        return 'Starting needs 3 to 5 players. Invite more players before starting.'
      default:
        return null
    }
  })
}

/** Creates a lobby; the creator becomes host. */
export async function createLobby(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  playerName: string,
): Promise<CreateLobbyResponse> {
  const name = playerName.trim()
  const problem = playerNameProblem(name, 'create a lobby')
  if (problem) {
    throw new Error(problem)
  }
  const client = apiClientsFor(fetchFn, apiBaseUrl).session
  return callApi('create a lobby', () => createLobbyCall({ client, body: { playerName: name } }))
}

/** Recovers authoritative membership/host/start state; the reload-safe read. */
export async function getLobby(fetchFn: AuthenticatedFetchFn, apiBaseUrl: string, lobbyId: string): Promise<LobbyResponse> {
  if (!lobbyId.trim()) {
    throw new Error('A lobby reference is needed to refresh membership.')
  }
  const client = apiClientsFor(fetchFn, apiBaseUrl).session
  const lobby = await callApi('refresh the lobby', () => getLobbyCall({ client, path: { lobbyId } }))
  // The contract promises the caller is one of the members; a view that breaks it proves nothing.
  if (lobby.currentPlayerId && !lobby.members.some((member) => member.playerId === lobby.currentPlayerId)) {
    throw new Error('Lobby response caller identity is not a lobby member.')
  }
  return lobby
}

/** Joins a lobby. A `409-02` means the membership already landed: reconcile. */
export async function joinLobby(
  fetchFn: AuthenticatedFetchFn,
  apiBaseUrl: string,
  lobbyId: string,
  playerName: string,
): Promise<JoinLobbyResponse> {
  const name = playerName.trim()
  if (!lobbyId.trim()) {
    throw new Error('A lobby reference is needed to join.')
  }
  const problem = playerNameProblem(name, 'join the lobby')
  if (problem) {
    throw new Error(problem)
  }
  const client = apiClientsFor(fetchFn, apiBaseUrl).session
  return callApi('join the lobby', () => joinLobbyCall({ client, path: { lobbyId }, body: { playerName: name } }))
}

/** Leaves a lobby. */
export async function leaveLobby(fetchFn: AuthenticatedFetchFn, apiBaseUrl: string, lobbyId: string): Promise<void> {
  if (!lobbyId.trim()) {
    throw new Error('A lobby reference is needed to leave.')
  }
  const client = apiClientsFor(fetchFn, apiBaseUrl).session
  await callApi('leave the lobby', () => leaveLobbyCall({ client, path: { lobbyId } }))
}

/** Starts the game; host-only with an adopted 3-5 roster. */
export async function startGame(fetchFn: AuthenticatedFetchFn, apiBaseUrl: string, lobbyId: string): Promise<StartGameResponse> {
  if (!lobbyId.trim()) {
    throw new Error('A lobby reference is needed to start.')
  }
  const client = apiClientsFor(fetchFn, apiBaseUrl).session
  return callApi('start the game', () => startGameCall({ client, path: { lobbyId } }))
}
