import { describe, expect, it, vi } from 'vitest'
import { createGameOidcClient, oidcIssuerHost } from './oidcClient'
import type { AppConfig } from '../config/appConfig'

const seen = vi.hoisted(() => ({ options: null as Record<string, unknown> | null }))

vi.mock('oidc-client-ts', () => ({
  UserManager: class {
    constructor(options: Record<string, unknown>) {
      seen.options = options
    }
  },
  WebStorageStateStore: class {
    constructor(options: Record<string, unknown>) {
      Object.assign(this, options)
    }
  },
}))

const config: AppConfig = {
  apiBaseUrl: 'https://api.example.test',
  oidcIssuerUrl: 'https://issuer.example.test/',
  oidcClientId: 'game-client',
  oidcAudience: 'https://api.example.test',
}

describe('createGameOidcClient', () => {
  it('configures discovery against the issuer, PKCE code flow and a reload-safe user store', () => {
    createGameOidcClient(config)

    expect(seen.options).toMatchObject({
      authority: config.oidcIssuerUrl,
      client_id: 'game-client',
      response_type: 'code',
      automaticSilentRenew: false,
    })
    expect(seen.options?.['scope']).toContain('openid')
    expect(typeof seen.options?.['redirect_uri']).toBe('string')
    expect(seen.options?.['userStore']).toBeInstanceOf(Object)
    const extraParams = seen.options?.['extraQueryParams'] as Record<string, unknown>
    expect(extraParams['audience']).toBe('https://api.example.test')
  })

  it('derives bare hosts with ports and tolerates trailing slashes', () => {
    expect(oidcIssuerHost('https://issuer.example.test/')).toBe('issuer.example.test')
    expect(oidcIssuerHost('https://issuer.example.test:8443/realms/game')).toBe('issuer.example.test:8443')
  })
})
