import { describe, expect, it } from 'vitest'
import { resolveAppConfig, type AppEnv } from './appConfig'

const validEnv: AppEnv = {
  VITE_API_BASE_URL: 'https://api.example.test',
  VITE_OIDC_ISSUER_URL: 'https://issuer.example.test',
  VITE_OIDC_CLIENT_ID: 'game-client',
  VITE_OIDC_AUDIENCE: 'https://api.example.test',
}

describe('resolveAppConfig', () => {
  it('accepts a fully configured environment', () => {
    const result = resolveAppConfig(validEnv)

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
      VITE_API_BASE_URL: '',
      VITE_OIDC_ISSUER_URL: '',
      VITE_OIDC_CLIENT_ID: '',
      VITE_OIDC_AUDIENCE: '',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toHaveLength(4)
    }
  })

  it('rejects a malformed API URL without inventing a fallback', () => {
    const result = resolveAppConfig({ ...validEnv, VITE_API_BASE_URL: 'not-a-url' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContain('VITE_API_BASE_URL must be an absolute http(s) URL.')
    }
  })

  it('rejects a malformed OIDC issuer URL', () => {
    const result = resolveAppConfig({ ...validEnv, VITE_OIDC_ISSUER_URL: 'not-a-url' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContain('VITE_OIDC_ISSUER_URL must be an absolute http(s) URL.')
    }
  })
})
