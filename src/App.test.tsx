import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { SessionBar } from './components/SessionBar'
import { SignInPanel } from './components/SignInPanel'

const validEnv = {
  VITE_API_BASE_URL: 'https://api.example.test',
  VITE_OIDC_ISSUER_URL: 'https://issuer.example.test',
  VITE_OIDC_CLIENT_ID: 'game-client',
}

const signedInSession = {
  accessToken: 'access',
  idToken: 'id',
  expiresAtEpochMs: 9_999_999_999_999,
  identity: { subject: 'auth0|one', issuer: 'https://issuer.example.test', displayName: 'player-one' },
}

describe('App', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', validEnv.VITE_API_BASE_URL)
    vi.stubEnv('VITE_OIDC_ISSUER_URL', validEnv.VITE_OIDC_ISSUER_URL)
    vi.stubEnv('VITE_OIDC_CLIENT_ID', validEnv.VITE_OIDC_CLIENT_ID)
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('shows a configuration error instead of inventing state when config is missing', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('not configured')
  })

  it('shows a recoverable connectivity error when the API is unreachable, and recovers on retry', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not connect')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in to play' })).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gates gameplay behind sign-in instead of fabricating a player', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Sign in to play' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Temporal Rift' })).not.toBeInTheDocument()
  })

  it('restores an authenticated session and keeps private state identity-bound', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    sessionStorage.setItem('temporal-rift.auth.session.v1', JSON.stringify(signedInSession))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Temporal Rift' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Current player session' })).toHaveTextContent('player-one')

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in to play' })).toBeInTheDocument()
    expect(sessionStorage.getItem('temporal-rift.auth.session.v1')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Temporal Rift' })).not.toBeInTheDocument()
  })

  it('clears expired sessions and offers recoverable reauthentication', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    sessionStorage.setItem(
      'temporal-rift.auth.session.v1',
      JSON.stringify({ ...signedInSession, expiresAtEpochMs: 1 }),
    )

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Sign in to play' })).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent('expired')
    expect(sessionStorage.getItem('temporal-rift.auth.session.v1')).toBeNull()
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
    render(<SessionBar identity={signedInSession.identity} onSignOut={() => {}} />)

    expect(screen.getByRole('status', { name: 'Current player session' })).toHaveTextContent('player-one')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})
