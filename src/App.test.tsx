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

const validEnv = {
  VITE_API_BASE_URL: 'https://api.example.test',
  VITE_OIDC_ISSUER_URL: 'https://issuer.example.test',
  VITE_OIDC_CLIENT_ID: 'game-client',
  VITE_OIDC_AUDIENCE: 'https://api.example.test',
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
    vi.stubEnv('VITE_API_BASE_URL', validEnv.VITE_API_BASE_URL)
    vi.stubEnv('VITE_OIDC_ISSUER_URL', validEnv.VITE_OIDC_ISSUER_URL)
    vi.stubEnv('VITE_OIDC_CLIENT_ID', validEnv.VITE_OIDC_CLIENT_ID)
    vi.stubEnv('VITE_OIDC_AUDIENCE', validEnv.VITE_OIDC_AUDIENCE)
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
    vi.mocked(UserManager).mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('shows a configuration error instead of inventing state when config is missing', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
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
})

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
