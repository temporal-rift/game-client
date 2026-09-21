export interface AppConfig {
  readonly apiBaseUrl: string
  readonly oidcIssuerUrl: string
  readonly oidcClientId: string
  readonly oidcAudience: string
}

export interface AppEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_OIDC_ISSUER_URL?: string
  readonly VITE_OIDC_CLIENT_ID?: string
  readonly VITE_OIDC_AUDIENCE?: string
}

export type AppConfigResult =
  | { readonly ok: true; readonly config: AppConfig }
  | { readonly ok: false; readonly errors: readonly string[] }

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validates the browser-supplied runtime configuration before anything
 * renders. Missing or malformed values must surface as a recoverable
 * configuration error rather than a crash or invented default.
 */
export function resolveAppConfig(env: AppEnv): AppConfigResult {
  const errors: string[] = []

  const apiBaseUrl = env.VITE_API_BASE_URL?.trim()
  if (!apiBaseUrl) {
    errors.push('VITE_API_BASE_URL is not configured.')
  } else if (!isAbsoluteHttpUrl(apiBaseUrl)) {
    errors.push('VITE_API_BASE_URL must be an absolute http(s) URL.')
  }

  const oidcIssuerUrl = env.VITE_OIDC_ISSUER_URL?.trim()
  if (!oidcIssuerUrl) {
    errors.push('VITE_OIDC_ISSUER_URL is not configured.')
  } else if (!isAbsoluteHttpUrl(oidcIssuerUrl)) {
    errors.push('VITE_OIDC_ISSUER_URL must be an absolute http(s) URL.')
  }

  const oidcClientId = env.VITE_OIDC_CLIENT_ID?.trim()
  if (!oidcClientId) {
    errors.push('VITE_OIDC_CLIENT_ID is not configured.')
  }

  const oidcAudience = env.VITE_OIDC_AUDIENCE?.trim()
  if (!oidcAudience) {
    errors.push('VITE_OIDC_AUDIENCE is not configured.')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    config: {
      apiBaseUrl: apiBaseUrl!,
      oidcIssuerUrl: oidcIssuerUrl!,
      oidcClientId: oidcClientId!,
      oidcAudience: oidcAudience!,
    },
  }
}
