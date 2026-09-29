import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserManager } from 'oidc-client-ts'
import App from './App'
import { SessionBar } from './components/SessionBar'
import { SignInPanel } from './components/SignInPanel'

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
    window.history.replaceState(null, '', '/lobbies/lobby-1')
    vi.stubGlobal('fetch', lobbyServer(() => lobbyView('STARTED')))
    sdk.client = signedInClient()

    render(<App />)

    await userEvent.click(await screen.findByRole('link', { name: 'Open game' }))

    expect(window.location.pathname).toBe('/games/game-1')
    expect(screen.queryByRole('heading', { name: 'Game lobby' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Back to lobby' }))

    expect(window.location.pathname).toBe('/lobbies/lobby-1')
    expect(screen.getByRole('heading', { name: 'Game lobby' })).toBeInTheDocument()
    expect(screen.queryByText('Sample board · actions are disabled')).not.toBeInTheDocument()
  })

  it('follows the start from the lobby page into the game page', async () => {
    rememberLobbyMembership()
    window.history.replaceState(null, '', '/lobbies/lobby-1')
    let status: 'WAITING' | 'STARTED' = 'WAITING'
    vi.stubGlobal(
      'fetch',
      lobbyServer(() => lobbyView(status, 3), (url) => {
        if (url.endsWith('/api/v1/lobbies/lobby-1/start')) {
          status = 'STARTED'
          return { gameId: 'game-1' }
        }
        return null
      }),
    )
    sdk.client = signedInClient()

    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Start game' }))

    await waitFor(() => expect(window.location.pathname).toBe('/games/game-1'))
    expect(await screen.findByRole('link', { name: 'Back to lobby' })).toHaveAttribute('href', '/lobbies/lobby-1')
  })

  it('sends the home page to the started game once lobby recovery settles', async () => {
    rememberLobbyMembership()
    sessionStorage.setItem('temporal-rift.private.lobbyId', 'lobby-1')
    vi.stubGlobal('fetch', lobbyServer(() => lobbyView('STARTED')))
    sdk.client = signedInClient()

    render(<App />)

    await waitFor(() => expect(window.location.pathname).toBe('/games/game-1'))
  })

  it('lands legacy ?game= invitations on the lobby page', async () => {
    window.history.replaceState(null, '', '/?game=lobby-1')
    vi.stubGlobal('fetch', lobbyServer(() => ({ ...lobbyView('WAITING'), currentPlayerId: undefined })))
    sdk.client = signedInClient()

    render(<App />)

    await waitFor(() => expect(window.location.pathname).toBe('/lobbies/lobby-1'))
    const invitation = await screen.findByRole('region', { name: 'Lobby invitation' })
    expect(invitation).toHaveTextContent(/lobby-1/)
    expect(screen.getByLabelText('Player name')).toHaveValue('player-one')
  })
})

function signedInClient(): Record<string, unknown> {
  return stubClient({
    getUser: async () => ({ profile: { sub: 'one', preferred_username: 'player-one' }, access_token: 'token' }),
  })
}

function rememberLobbyMembership(): void {
  sessionStorage.setItem('temporal-rift.private.playerId', 'p1')
}

function lobbyView(status: 'WAITING' | 'STARTED', memberCount = 1): Record<string, unknown> {
  return {
    lobbyId: 'lobby-1',
    gameId: 'game-1',
    hostPlayerId: 'p1',
    currentPlayerId: 'p1',
    status,
    members: Array.from({ length: memberCount }, (_, index) => ({
      playerId: `p${index + 1}`,
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
    return url.endsWith('/api/v1/lobbies/lobby-1') ? json(readLobby()) : new Response(null, { status: 200 })
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
