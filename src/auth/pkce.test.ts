import { describe, expect, it } from 'vitest'
import { base64UrlEncodeString, createCodeVerifier, createOAuthState, toCodeChallenge } from './pkce'

describe('pkce', () => {
  it('derives the RFC 7636 appendix B challenge', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'

    await expect(toCodeChallenge(verifier)).resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('creates verifiers without padding or reserved characters', () => {
    for (let index = 0; index < 5; index += 1) {
      const verifier = createCodeVerifier()
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    }
  })

  it('creates unique opaque states', () => {
    const states = new Set([createOAuthState(), createOAuthState(), createOAuthState()])
    expect(states.size).toBe(3)
  })

  it('base64url-encodes without padding', () => {
    expect(base64UrlEncodeString('hello')).toBe('aGVsbG8')
  })
})
