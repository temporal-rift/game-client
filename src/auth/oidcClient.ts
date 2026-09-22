import { UserManager, WebStorageStateStore } from 'oidc-client-ts'
import type { AppConfig } from '../config/appConfig'

/** The issuer's host, for display only (e.g. `https://issuer.example.test/` -> `issuer.example.test`). */
export function oidcIssuerHost(issuerUrl: string): string {
  return new URL(issuerUrl.trim()).host
}

/**
 * Builds the maintained oidc-client-ts `UserManager` that owns the whole OIDC
 * protocol: discovery against the configured issuer, authorization code +
 * PKCE, the token exchange, ID-token validation, the login transaction and
 * token caching. Generic and discovery-based rather than tied to one
 * identity provider's own API conventions, so any standards-compliant
 * issuer works without a code change — including an isolated test issuer.
 *
 * Persistence follows the SDK's recommended mechanism for sessions that
 * must survive a page reload: a `localStorage`-backed user store.
 */
export function createGameOidcClient(config: AppConfig): UserManager {
  return new UserManager({
    authority: config.oidcIssuerUrl,
    client_id: config.oidcClientId,
    redirect_uri: `${window.location.origin}${window.location.pathname}`,
    response_type: 'code',
    // offline_access requests a refresh token so getAccessToken's on-demand signinSilent() call
    // can renew via that token. Without it, an issuer that omits a refresh token forces
    // signinSilent()'s iframe fallback, which needs a dedicated silent_redirect_uri callback page
    // this client does not configure — that path degrades to a safe, self-announcing re-login
    // rather than silently failing, but is not a substitute for requesting a refresh token from
    // any issuer that honors this scope.
    scope: 'openid profile email offline_access',
    extraQueryParams: { audience: config.oidcAudience },
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    automaticSilentRenew: false,
  })
}
