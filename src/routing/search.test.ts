import { describe, expect, it } from 'vitest'
import { parseSearch, stringifySearch } from './search'

describe('search params', () => {
  it('keeps every value a plain string, the first of a repeated parameter winning', () => {
    expect(parseSearch('?game=123&flag=true&game=other&code=%7B%22a%22%3A1%7D')).toEqual({
      game: '123',
      flag: 'true',
      code: '{"a":1}',
    })
    expect(parseSearch('')).toEqual({})
  })

  it('writes defined values only, and nothing for an empty search', () => {
    expect(stringifySearch({ game: 'lobby-1', skip: undefined, none: null })).toBe('?game=lobby-1')
    expect(stringifySearch({})).toBe('')
  })
})
