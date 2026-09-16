import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const validEnv = {
  VITE_API_BASE_URL: 'https://api.example.test',
  VITE_OIDC_ISSUER_URL: 'https://issuer.example.test',
  VITE_OIDC_CLIENT_ID: 'game-client',
}

describe('App', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', validEnv.VITE_API_BASE_URL)
    vi.stubEnv('VITE_OIDC_ISSUER_URL', validEnv.VITE_OIDC_ISSUER_URL)
    vi.stubEnv('VITE_OIDC_CLIENT_ID', validEnv.VITE_OIDC_CLIENT_ID)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('shows a configuration error instead of inventing state when config is missing', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('not configured')
  })

  it('shows a recoverable connectivity error when the API is unreachable, and recovers on retry', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not connect')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Event board' })).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('renders the fixture-backed shell once connectivity succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Temporal Rift' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Event board' })).toBeInTheDocument()
  })
})
