import { describe, expect, it } from 'vitest'
import {
  buildGameInvitationUrl,
  cleanAuthCallbackUrl,
  parseAuthCallback,
  parseGameInvitation,
  urlCarriesCredentials,
} from './invitation'

describe('invitation and callback URLs', () => {
  it('round-trips invitations carrying only the game reference', () => {
    const href = buildGameInvitationUrl('https://app.example.test/', 'game-123')

    expect(href).toBe('https://app.example.test/?game=game-123')
    expect(urlCarriesCredentials(href)).toBe(false)
    expect(parseGameInvitation(new URL(href).search)).toEqual({ gameId: 'game-123' })
  })

  it('never derives player identity from invitation parameters', () => {
    const invitation = parseGameInvitation('?game=game-123&player=attacker&access_token=stolen&id_token=stolen')

    expect(invitation).toEqual({ gameId: 'game-123' })
  })

  it('returns null when no game reference is present', () => {
    expect(parseGameInvitation('?player=someone')).toBeNull()
  })

  it('rejects malformed game references instead of storing them', () => {
    expect(parseGameInvitation('?game=<script>alert(1)</script>')).toBeNull()
    expect(parseGameInvitation(`?game=${'a'.repeat(200)}`)).toBeNull()
    expect(() => buildGameInvitationUrl('https://app.example.test', 'not a reference!')).toThrow()
  })

  it('parses callback denials for user-friendly handling', () => {
    expect(parseAuthCallback('?error=access_denied&error_description=denied')).toEqual({
      code: null,
      state: null,
      error: 'access_denied',
      errorDescription: 'denied',
    })
  })

  it('cleans callback codes while preserving the invitation', () => {
    const cleaned = new URL(cleanAuthCallbackUrl('https://app.example.test/?game=game-123&code=secret&state=xyz'))

    expect(cleaned.searchParams.get('code')).toBeNull()
    expect(cleaned.searchParams.get('state')).toBeNull()
    expect(cleaned.searchParams.get('game')).toBe('game-123')
    expect(urlCarriesCredentials(cleaned.toString())).toBe(false)
  })

  it('detects credential material in URLs', () => {
    expect(urlCarriesCredentials('https://app/?access_token=x')).toBe(true)
    expect(urlCarriesCredentials('https://app/?game=game-123')).toBe(false)
  })
})
