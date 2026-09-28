import { describe, expect, it } from 'vitest'
import {
  buildLobbyInvitationUrl,
  parseAuthCallback,
  parseLegacyLobbyInvitation,
  parseLobbyReference,
  urlCarriesCredentials,
} from './invitation'

describe('invitation and callback URLs', () => {
  it('builds invitations as the lobby page, carrying only the lobby reference', () => {
    const href = buildLobbyInvitationUrl('https://app.example.test/', 'lobby-123')

    expect(href).toBe('https://app.example.test/lobbies/lobby-123')
    expect(urlCarriesCredentials(href)).toBe(false)
    expect(parseLobbyReference(href)).toEqual({ lobbyId: 'lobby-123' })
  })

  it('refuses to build an invitation for a malformed reference', () => {
    expect(() => buildLobbyInvitationUrl('https://app.example.test', 'not a reference!')).toThrow()
  })

  it('still reads legacy ?game= invitations without deriving identity from them', () => {
    expect(parseLegacyLobbyInvitation('?game=lobby-123&player=attacker&access_token=stolen')).toEqual({
      lobbyId: 'lobby-123',
    })
    expect(parseLegacyLobbyInvitation('?player=someone')).toBeNull()
    expect(parseLegacyLobbyInvitation('?game=<script>alert(1)</script>')).toBeNull()
    expect(parseLegacyLobbyInvitation(`?game=${'a'.repeat(200)}`)).toBeNull()
  })

  it('accepts only an exact lobby reference or an unambiguous invitation URL', () => {
    expect(parseLobbyReference('lobby-123')).toEqual({ lobbyId: 'lobby-123' })
    expect(parseLobbyReference('https://app.example.test/lobbies/lobby-123')).toEqual({ lobbyId: 'lobby-123' })
    expect(parseLobbyReference('https://app.example.test/?game=lobby-123')).toEqual({ lobbyId: 'lobby-123' })
    expect(parseLobbyReference('lobby-123?game=another-lobby')).toBeNull()
    expect(parseLobbyReference('https://app.example.test/lobbies/lobby-123?game=another-lobby')).toBeNull()
    expect(parseLobbyReference('https://app.example.test/lobbies/lobby-123#fragment')).toBeNull()
    expect(parseLobbyReference('https://app.example.test/lobbies/lobby-123/extra')).toBeNull()
    expect(parseLobbyReference('https://app.example.test/games/lobby-123')).toBeNull()
    expect(parseLobbyReference('https://app.example.test/?game=lobby-123&other=value')).toBeNull()
    expect(parseLobbyReference('https://app.example.test/?game=not a reference')).toBeNull()
    expect(parseLobbyReference('javascript:alert(1)')).toBeNull()
  })

  it('parses callback denials for user-friendly handling', () => {
    expect(parseAuthCallback('?error=access_denied&error_description=denied')).toEqual({
      code: null,
      state: null,
      error: 'access_denied',
      errorDescription: 'denied',
    })
  })

  it('detects credential material in URLs', () => {
    expect(urlCarriesCredentials('https://app/?access_token=x')).toBe(true)
    expect(urlCarriesCredentials('https://app/lobbies/lobby-123')).toBe(false)
  })
})
