import { Auth0Client } from '@auth0/auth0-spa-js'
import type { AppConfig } from '../config/appConfig'

/**
 * Derives the Auth0 tenant domain from the configured issuer URL
 * (e.g. `https://kronen.eu.auth0.com/` -> `kronen.eu.auth0.com`).
 */
export function auth0DomainForIssuer(issuerUrl: string): string {
  return new URL(issuerUrl.trim()).host
}

/**
 * Builds the maintained Auth0 SPA client that owns the whole OIDC
 * protocol: discovery, authorization code + PKCE, the token exchange,
 * ID-token validation, the login transaction and token caching.
 *
 * Persistence follows the SDK's recommended mechanism for sessions that
 * must survive a page reload: the localstorage cache with rotating
 * refresh tokens (enabled for the application in the Auth0 dashboard).
 * Silent renewal then keeps the session alive; when renewal fails the
 * caller falls back to interactive sign-in.
 */
export function createGameAuth0Client(config: AppConfig): Auth0Client {
  return new Auth0Client({
    domain: auth0DomainForIssuer(config.oidcIssuerUrl),
    clientId: config.oidcClientId,
    authorizationParams: {
      audience: config.oidcAudience,
      scope: 'openid profile email',
      redirect_uri: `${window.location.origin}${window.location.pathname}`,
    },
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
  })
}
