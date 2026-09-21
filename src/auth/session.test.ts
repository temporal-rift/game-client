import { describe, expect, it } from 'vitest'
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

  it('prefers username over email over name', () => {
    expect(identityFromUser({ sub: 's', email: 'a@b.c', name: 'n' })?.displayName).toBe('a@b.c')
    expect(identityFromUser({ sub: 's', name: 'n' })?.displayName).toBe('n')
    expect(identityFromUser({ sub: 's' })?.displayName).toBeNull()
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
})
