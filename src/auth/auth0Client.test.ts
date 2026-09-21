import { describe, expect, it, vi } from 'vitest'
import { createGameAuth0Client, auth0DomainForIssuer } from './auth0Client'
import type { AppConfig } from '../config/appConfig'

const seen = vi.hoisted(() => ({ options: null as Record<string, unknown> | null }))

vi.mock('@auth0/auth0-spa-js', () => ({
  Auth0Client: class {
    constructor(options: Record<string, unknown>) {
      seen.options = options
    }
  },
}))

const config: AppConfig = {
  apiBaseUrl: 'https://api.example.test',
  oidcIssuerUrl: 'https://issuer.example.test/',
  oidcClientId: 'game-client',
  oidcAudience: 'https://api.example.test',
}

describe('createGameAuth0Client', () => {
  it('configures the Auth0 tenant, audience and reload-safe token cache', () => {
    createGameAuth0Client(config)

    expect(seen.options).toMatchObject({
      domain: 'issuer.example.test',
      clientId: 'game-client',
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
    })
    const params = seen.options?.['authorizationParams'] as Record<string, unknown>
    expect(params['audience']).toBe('https://api.example.test')
    expect(params['scope']).toContain('openid')
    expect(typeof params['redirect_uri']).toBe('string')
  })

  it('derives bare domains with ports and tolerates trailing slashes', () => {
    expect(auth0DomainForIssuer('https://issuer.example.test/')).toBe('issuer.example.test')
    expect(auth0DomainForIssuer('https://issuer.example.test:8443/realms/game')).toBe('issuer.example.test:8443')
  })
})
