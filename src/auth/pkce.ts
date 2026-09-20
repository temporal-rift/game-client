/**
 * PKCE (RFC 7636) helpers for the OIDC authorization-code flow.
 *
 * The browser is a public client: it authenticates with a per-login
 * code verifier/challenge pair and never carries a client secret.
 */

const VERIFIER_BYTES = 32

function base64UrlEncodeBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) {
    binary += String.fromCodePoint(byte)
  }
  let encoded = btoa(binary).replaceAll('+', '-').replaceAll('/', '_')
  while (encoded.endsWith('=')) {
    encoded = encoded.slice(0, -1)
  }
  return encoded
}

export function base64UrlEncodeString(value: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(value))
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/** Creates a high-entropy code verifier (43 base64url characters). */
export function createCodeVerifier(): string {
  return base64UrlEncodeBytes(randomBytes(VERIFIER_BYTES))
}

/**
 * Derives the S256 code challenge for a verifier.
 * Uses WebCrypto SHA-256; the verifier itself never leaves the browser
 * except in the token exchange over HTTPS.
 */
export async function toCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncodeBytes(digest)
}

/** Creates an opaque OAuth state/nonce value. */
export function createOAuthState(): string {
  return base64UrlEncodeBytes(randomBytes(VERIFIER_BYTES))
}
