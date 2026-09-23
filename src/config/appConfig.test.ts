import { describe, expect, it } from 'vitest'
import { resolveAppConfig, type RuntimeConfig } from './appConfig'

const validConfig: RuntimeConfig = {
  apiBaseUrl: 'https://api.example.test',
  oidcIssuerUrl: 'https://issuer.example.test',
  oidcClientId: 'game-client',
  oidcAudience: 'https://api.example.test',
}

describe('resolveAppConfig', () => {
  it('accepts a fully configured runtime config', () => {
    const result = resolveAppConfig(validConfig)

    expect(result).toEqual({
      ok: true,
      config: {
        apiBaseUrl: 'https://api.example.test',
        oidcIssuerUrl: 'https://issuer.example.test',
        oidcClientId: 'game-client',
        oidcAudience: 'https://api.example.test',
      },
    })
  })

  it('reports every missing value', () => {
    const result = resolveAppConfig({
      apiBaseUrl: '',
      oidcIssuerUrl: '',
      oidcClientId: '',
      oidcAudience: '',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toHaveLength(4)
    }
  })

  it('rejects a malformed API URL without inventing a fallback', () => {
    const result = resolveAppConfig({ ...validConfig, apiBaseUrl: 'not-a-url' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContain('apiBaseUrl must be an absolute http(s) URL.')
    }
  })

  it('rejects a malformed OIDC issuer URL', () => {
    const result = resolveAppConfig({ ...validConfig, oidcIssuerUrl: 'not-a-url' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContain('oidcIssuerUrl must be an absolute http(s) URL.')
    }
  })
})
