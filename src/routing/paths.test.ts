import { describe, expect, it } from 'vitest'
import { AUTH_CALLBACK_PATH, isResourceReference, lobbyPath, safeReturnTo } from './paths'

describe('client paths', () => {
  it('builds lobby pages from valid references only', () => {
    expect(lobbyPath('lobby-1')).toBe('/lobbies/lobby-1')
    expect(lobbyPath('lobby_1')).toBe('/lobbies/lobby_1')
    expect(() => lobbyPath('../admin')).toThrow()
    expect(() => lobbyPath('')).toThrow()
  })

  it('recognises server-issued references', () => {
    expect(isResourceReference('3f2a9c1e-7b4d-4e8f-9a0b-1c2d3e4f5a6b')).toBe(true)
    expect(isResourceReference('with space')).toBe(false)
    expect(isResourceReference(undefined)).toBe(false)
  })

  it('keeps app-relative return paths with their query', () => {
    expect(safeReturnTo('/games/game-1')).toBe('/games/game-1')
    expect(safeReturnTo('/?game=lobby-1')).toBe('/?game=lobby-1')
  })

  it('never turns the sign-in round-trip into an open redirect', () => {
    expect(safeReturnTo('https://evil.example/')).toBeNull()
    expect(safeReturnTo('//evil.example/path')).toBeNull()
    expect(safeReturnTo('/\\evil.example')).toBeNull()
    expect(safeReturnTo('games/game-1')).toBeNull()
    expect(safeReturnTo(42)).toBeNull()
    expect(safeReturnTo(undefined)).toBeNull()
  })

  it('refuses to return to the callback page itself', () => {
    expect(safeReturnTo(AUTH_CALLBACK_PATH)).toBeNull()
    expect(safeReturnTo(`${AUTH_CALLBACK_PATH}?code=x&state=y`)).toBeNull()
  })
})
