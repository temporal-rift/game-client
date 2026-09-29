import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../api/queryClient'
import { clearPrivateCaches, identityFromUser, sameIdentity } from './session'

function memoryStorage(): Storage {
  const backing = new Map<string, string>()
  return {
    get length() {
      return backing.size
    },
    clear: () => backing.clear(),
    getItem: (key: string) => backing.get(key) ?? null,
    key: (index: number) => [...backing.keys()][index] ?? null,
    removeItem: (key: string) => {
      backing.delete(key)
    },
    setItem: (key: string, value: string) => {
      backing.set(key, value)
    },
  } as Storage
}

describe('identityFromUser', () => {
  it('maps the SDK user to a player identity', () => {
    expect(identityFromUser({ sub: 'auth0|one', preferred_username: 'one' })).toEqual({
      subject: 'auth0|one',
      displayName: 'one',
    })
  })

  it('prefers username over name', () => {
    expect(identityFromUser({ sub: 's', preferred_username: 'u', name: 'n' })?.displayName).toBe('u')
    expect(identityFromUser({ sub: 's', preferred_username: '  ', name: 'n' })?.displayName).toBe('n')
    expect(identityFromUser({ sub: 's' })?.displayName).toBeNull()
  })

  it('never uses the email claim as a display name', () => {
    const profile = { sub: 's', email: 'a@b.c' }
    expect(identityFromUser(profile)?.displayName).toBeNull()
  })

  it('rejects users without a subject instead of fabricating identity', () => {
    expect(identityFromUser({})).toBeNull()
    expect(identityFromUser({ sub: '' })).toBeNull()
  })

  it('compares identities by subject', () => {
    expect(sameIdentity({ subject: 'a', displayName: null }, { subject: 'a', displayName: 'x' })).toBe(true)
    expect(sameIdentity({ subject: 'a', displayName: null }, { subject: 'b', displayName: null })).toBe(false)
  })
})

describe('clearPrivateCaches', () => {
  it('clears only the private namespace and keeps everything else', () => {
    const storage = memoryStorage()
    storage.setItem('temporal-rift.private.hand', 'private')
    storage.setItem('unrelated', 'keep')

    clearPrivateCaches(storage)

    expect(storage.getItem('temporal-rift.private.hand')).toBeNull()
    expect(storage.getItem('unrelated')).toBe('keep')
  })

  it('tolerates missing storage', () => {
    expect(() => clearPrivateCaches(null)).not.toThrow()
  })

  it('also empties the cached server state, so nothing private survives a player change', () => {
    const serverState = createQueryClient()
    serverState.setQueryData(['temporal-rift', 'one', 'game-state', 'game-1'], { myHand: ['secret'] })

    clearPrivateCaches(null, serverState)

    expect(serverState.getQueryCache().getAll()).toHaveLength(0)
  })
})
