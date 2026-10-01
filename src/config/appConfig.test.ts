import { describe, expect, it } from 'vitest'
import { resolveAppConfig, type RuntimeConfig } from './appConfig'

const validConfig: RuntimeConfig = {
  apiBaseUrl: 'https://api.example.test',
  oidcIssuerUrl: 'https://issuer.example.test',
  oidcClientId: 'game-client',
      oidcAudience: 'https://api.example.test',
      illustrationSkin: 'board',
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
        illustrationSkin: 'board',
      },
    })
  })

  it('defaults the optional illustration skin to the established Board skin', () => {
    const { illustrationSkin: _ignored, ...withoutSkin } = validConfig
    expect(resolveAppConfig(withoutSkin)).toMatchObject({ ok: true, config: { illustrationSkin: 'board' } })
  })

  it('accepts Engraving and rejects unsupported illustration skins', () => {
    expect(resolveAppConfig({ ...validConfig, illustrationSkin: 'engraving' })).toMatchObject({
      ok: true,
      config: { illustrationSkin: 'engraving' },
    })
    expect(resolveAppConfig({ ...validConfig, illustrationSkin: 'unknown' }).ok).toBe(false)
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

  it('reports a missing value once, not also as malformed', () => {
    const result = resolveAppConfig({ ...validConfig, apiBaseUrl: '   ' })

    expect(result).toEqual({ ok: false, errors: ['apiBaseUrl is not configured.'] })
  })

  it('treats a config that is not an object as nothing configured', () => {
    for (const config of [undefined, null, 'apiBaseUrl=https://api.example.test', 42]) {
      const result = resolveAppConfig(config)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors).toEqual([
          'apiBaseUrl is not configured.',
          'oidcIssuerUrl is not configured.',
          'oidcClientId is not configured.',
          'oidcAudience is not configured.',
        ])
      }
    }
  })

  it('rejects non-text values and trims the ones it keeps', () => {
    const result = resolveAppConfig({ ...validConfig, oidcClientId: 7, oidcAudience: '  aud  ' })

    expect(result).toEqual({ ok: false, errors: ['oidcClientId is not configured.'] })
    expect(resolveAppConfig({ ...validConfig, oidcAudience: '  aud  ' })).toMatchObject({ ok: true, config: { oidcAudience: 'aud' } })
  })
})
