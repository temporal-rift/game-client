import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserManager } from 'oidc-client-ts'
import App from './App'
import { queryClient } from './api/queryClient'
import { SessionBar } from './components/SessionBar'
import { SignInPanel } from './components/SignInPanel'
import { gameStatePayload, sevenCardDeal } from './test/gameStatePayload'
import { uuid } from './test/uuid'

const LOBBY = uuid('lobby-1')
const GAME = uuid('game-1')
const P1 = uuid('p1')

const sdk = vi.hoisted(() => ({ client: null as Record<string, unknown> | null }))

vi.mock('oidc-client-ts', () => ({
  UserManager: vi.fn().mockImplementation(function MockUserManager(this: unknown) {
    if (!sdk.client) {
      throw new Error('stub UserManager is not configured')
    }
    return sdk.client
  }),
  WebStorageStateStore: vi.fn(),
}))

const validRuntimeConfig = {
  apiBaseUrl: 'https://api.example.test',
  oidcIssuerUrl: 'https://issuer.example.test',
  oidcClientId: 'game-client',
  oidcAudience: 'https://api.example.test',
  illustrationSkin: 'board',
}

function stubClient(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    getUser: async () => null,
    signinRedirectCallback: async () => ({ profile: {}, access_token: 'token' }),
    signinRedirect: async () => {},
    signoutRedirect: async () => {},
    removeUser: async () => {},
    signinSilent: async () => null,
    ...overrides,
  }
}

describe('App', () => {
  beforeEach(() => {
    window.__APP_CONFIG__ = { ...validRuntimeConfig }
    sessionStorage.clear()
    // The app keeps one server-state cache; each test starts without another test's responses.
    queryClient.clear()
    window.history.replaceState(null, '', '/')
    vi.mocked(UserManager).mockClear()
  })

  afterEach(() => {
    delete window.__APP_CONFIG__
    vi.unstubAllGlobals()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('shows a configuration error instead of inventing state when config is missing', async () => {
    window.__APP_CONFIG__ = { ...validRuntimeConfig, apiBaseUrl: '' }
    sdk.client = stubClient()

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('not configured')
  })

  it('shows a recoverable connectivity error when the API is unreachable, and recovers on retry', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    sdk.client = stubClient()

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not connect')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in to play' })).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gates gameplay behind sign-in instead of fabricating a player', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    sdk.client = stubClient()

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Sign in to play' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Temporal Rift' })).not.toBeInTheDocument()
  })

  it('restores an authenticated session and signs out through the SDK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    const signoutRedirect = vi.fn(async () => {})
    sdk.client = stubClient({
      getUser: async () => ({ profile: { sub: 'one', preferred_username: 'player-one' } }),
      signoutRedirect,
    })

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Temporal Rift' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Current player session' })).toHaveTextContent('player-one')

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(signoutRedirect).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('heading', { name: 'Sign in to play' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Temporal Rift' })).not.toBeInTheDocument()
  })

  it('keeps the lobby on its own page while no game is active', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    sdk.client = signedInClient()

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Game lobby' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/lobby')
    expect(screen.queryByText('Sample board · actions are disabled')).not.toBeInTheDocument()
  })

  it('opens a started game on its own page, with the lobby one link away', async () => {
    rememberLobbyMembership()
    window.history.replaceState(null, '', `/lobbies/${LOBBY}`)
    vi.stubGlobal('fetch', lobbyServer(() => lobbyView('STARTED')))
    sdk.client = signedInClient()

    render(<App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Open game' }))

    expect(window.location.pathname).toBe(`/games/${GAME}`)
    expect(screen.queryByRole('heading', { name: 'Game lobby' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Back to lobby' }))

    expect(window.location.pathname).toBe(`/lobbies/${LOBBY}`)
    expect(screen.getByRole('heading', { name: 'Game lobby' })).toBeInTheDocument()
    expect(screen.queryByText('Sample board · actions are disabled')).not.toBeInTheDocument()
  })

  it('follows the start from the lobby page into the game page', async () => {
    rememberLobbyMembership()
    window.history.replaceState(null, '', `/lobbies/${LOBBY}`)
    let status: 'WAITING' | 'STARTED' = 'WAITING'
    vi.stubGlobal(
      'fetch',
      lobbyServer(() => lobbyView(status, 3), (url) => {
        if (url.endsWith(`/api/v1/lobbies/${LOBBY}/start`)) {
          status = 'STARTED'
          return { gameId: GAME }
        }
        return null
      }),
    )
    sdk.client = signedInClient()

    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Start game' }))

    await waitFor(() => expect(window.location.pathname).toBe(`/games/${GAME}`))
    expect(await screen.findByRole('link', { name: 'Back to lobby' })).toHaveAttribute('href', `/lobbies/${LOBBY}`)
  })

  it('sends the home page to the started game once lobby recovery settles', async () => {
    rememberLobbyMembership()
    sessionStorage.setItem('temporal-rift.private.lobbyId', LOBBY)
    vi.stubGlobal('fetch', lobbyServer(() => lobbyView('STARTED')))
    sdk.client = signedInClient()

    render(<App />)

    await waitFor(() => expect(window.location.pathname).toBe(`/games/${GAME}`))
  })

  it('shows the live game on the board, never the sample board', async () => {
    rememberLobbyMembership()
    sessionStorage.setItem('temporal-rift.private.lobbyId', LOBBY)
    window.history.replaceState(null, '', `/games/${GAME}`)
    const state = gameStatePayload({
      gameId: GAME,
      eraNumber: 1,
      phase: 'ACTION_ROUND_2',
      roundNumber: 2,
      myFaction: 'ERASERS',
      players: [1, 2, 3].map((seat) => ({ playerId: uuid(`p${seat}`), playerName: `player-${seat}`, score: seat, isConnected: true })),
    })
    vi.stubGlobal(
      'fetch',
      lobbyServer(() => lobbyView('STARTED', 3), (url) => (url.endsWith(`/api/v1/games/${GAME}/state`) ? state : null)),
    )
    sdk.client = signedInClient()

    render(<App />)

    expect(await screen.findByText('Round 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('Era 1')).toBeInTheDocument()
    const players = screen.getByRole('region', { name: 'Player scores' })
    expect(await within(players).findByText('You · Erasers')).toBeInTheDocument()
    expect(within(players).getAllByText('Faction hidden')).toHaveLength(2)
    expect(screen.queryByText(/Sample board/)).not.toBeInTheDocument()
  })

  it('hosts an open hand selection in the illustrated board hand area', async () => {
    rememberLobbyMembership()
    sessionStorage.setItem('temporal-rift.private.lobbyId', LOBBY)
    window.history.replaceState(null, '', `/games/${GAME}`)
    const state = gameStatePayload({
      gameId: GAME,
      phase: 'HAND_SELECTION',
      deadlines: { handSelectionExpiresAt: '2030-01-01T00:01:30Z' },
      pendingHandSelection: {
        requiredSelectionCount: 5,
        expiresAt: '2030-01-01T00:01:30Z',
        cards: sevenCardDeal((slot) => ({
          cardInstanceId: uuid(`offer-${slot}`),
          cardType: 'PUSH',
          grade: slot === 1 ? 'III' : 'II',
          dealSlot: slot,
        })),
      },
    })
    vi.stubGlobal(
      'fetch',
      lobbyServer(() => lobbyView('STARTED', 3), (url) => (url.endsWith(`/api/v1/games/${GAME}/state`) ? state : null)),
    )
    sdk.client = signedInClient()

    render(<App />)

    const selection = await screen.findByRole('region', { name: 'Hand selection' })
    expect(selection).toHaveClass('private-hand')
    expect(within(selection).getByRole('list', { name: 'Private card offer' })).toBeInTheDocument()
    expect(within(selection).getByRole('button', { name: 'Confirm five cards' })).toBeDisabled()
    expect(screen.queryByRole('heading', { name: 'Your hand selection' })).not.toBeInTheDocument()
  })

  it('shows the recoverable game-state error instead of any board content', async () => {
    rememberLobbyMembership()
    window.history.replaceState(null, '', `/games/${GAME}`)
    const notFound = new Response(JSON.stringify({ type: 'about:blank', title: 'Not Found', status: 404, code: '404-01' }), {
      status: 404,
      headers: { 'Content-Type': 'application/problem+json' },
    })
    const server = lobbyServer(() => lobbyView('STARTED'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith(`/api/v1/games/${GAME}/state`) ? notFound.clone() : server(input),
      ),
    )
    sdk.client = signedInClient()

    render(<App />)

    const board = await screen.findByRole('region', { name: 'Game board' })
    expect(await within(board).findByRole('alert')).toHaveTextContent('Game not found, or you are not a participant of it.')
    expect(within(board).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Player scores' })).not.toBeInTheDocument()
  })

  it.each([
    ['an invalid lobby reference', '/lobbies/not%20a%20reference', '/lobby'],
    ['an invalid game reference', '/games/..%2Fadmin', '/lobby'],
    ['an unknown page', '/nowhere', '/lobby'],
    ['a signed-in visit to the sign-in callback', '/auth/callback', '/lobby'],
  ])('sends %s back to a page of the app', async (_case, path, landing) => {
    window.history.replaceState(null, '', path)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    sdk.client = signedInClient()

    render(<App />)

    await waitFor(() => expect(window.location.pathname).toBe(landing))
    expect(await screen.findByRole('heading', { name: 'Game lobby' })).toBeInTheDocument()
  })

  it('lands legacy ?game= invitations on the lobby page', async () => {
    window.history.replaceState(null, '', `/?game=${LOBBY}`)
    vi.stubGlobal('fetch', lobbyServer(() => ({ ...lobbyView('WAITING'), currentPlayerId: undefined })))
    sdk.client = signedInClient()

    render(<App />)

    await waitFor(() => expect(window.location.pathname).toBe(`/lobbies/${LOBBY}`))
    const invitation = await screen.findByRole('region', { name: 'Lobby invitation' })
    expect(invitation).toHaveTextContent(LOBBY)
    expect(screen.getByLabelText('Player name')).toHaveValue('player-one')
  })
})

function signedInClient(): Record<string, unknown> {
  return stubClient({
    getUser: async () => ({ profile: { sub: 'one', preferred_username: 'player-one' }, access_token: 'token' }),
  })
}

function rememberLobbyMembership(): void {
  sessionStorage.setItem('temporal-rift.private.playerId', P1)
}

function lobbyView(status: 'WAITING' | 'STARTED', memberCount = 1): Record<string, unknown> {
  return {
    lobbyId: LOBBY,
    gameId: GAME,
    hostPlayerId: P1,
    currentPlayerId: P1,
    status,
    members: Array.from({ length: memberCount }, (_, index) => ({
      playerId: uuid(`p${index + 1}`),
      playerName: `player-${index + 1}`,
      isHost: index === 0,
    })),
  }
}

/** Serves the lobby read (and optional commands) as JSON; every other call answers an empty 200. */
function lobbyServer(
  readLobby: () => Record<string, unknown>,
  command: (url: string) => Record<string, unknown> | null = () => null,
) {
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const commandResult = command(url)
    if (commandResult) {
      return json(commandResult)
    }
    return url.endsWith(`/api/v1/lobbies/${LOBBY}`) ? json(readLobby()) : new Response(null, { status: 200 })
  })
}

describe('player session components', () => {
  it('explains private sessions without exposing tokens', () => {
    render(
      <SignInPanel issuerUrl="https://issuer.example.test/realms/game" isSigningIn={false} notice={null} onSignIn={() => {}} />,
    )

    expect(screen.getByRole('heading', { name: 'Sign in to play' })).toBeInTheDocument()
    expect(screen.getByText(/issuer\.example\.test/)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('access_token')
  })

  it('shows the signed-in player with a sign-out control', () => {
    render(
      <SessionBar
        identity={{ subject: 'one', displayName: 'player-one' }}
        faction="ERASERS"
        onSignOut={() => {}}
      />,
    )

    expect(screen.getByRole('status', { name: 'Current player session' })).toHaveTextContent('player-one')
    expect(screen.getByLabelText('Your faction')).toHaveTextContent('Your faction: ERASERS')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('does not invent a faction before the server assigns one', () => {
    render(
      <SessionBar
        identity={{ subject: 'one', displayName: 'player-one' }}
        faction={null}
        onSignOut={() => {}}
      />,
    )

    expect(screen.queryByLabelText('Your faction')).not.toBeInTheDocument()
  })
})
