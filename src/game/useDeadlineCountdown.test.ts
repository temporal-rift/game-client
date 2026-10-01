import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deadlineRemainingSeconds, formatCountdown, useDeadlineCountdown } from './useDeadlineCountdown'

describe('deadlineRemainingSeconds', () => {
  it('converts a projected expiry timestamp to remaining seconds', () => {
    expect(deadlineRemainingSeconds('2026-01-01T00:01:01.001Z', Date.parse('2026-01-01T00:00:00Z'))).toBe(62)
  })

  it('returns null for a missing or invalid timestamp and zero after expiry', () => {
    expect(deadlineRemainingSeconds(null)).toBeNull()
    expect(deadlineRemainingSeconds('not-a-date')).toBeNull()
    expect(deadlineRemainingSeconds('2026-01-01T00:00:00Z', Date.parse('2026-01-01T00:00:01Z'))).toBe(0)
  })
})

describe('formatCountdown', () => {
  it('formats remaining seconds as minutes and zero-padded seconds', () => {
    expect(formatCountdown(90)).toBe('1:30')
    expect(formatCountdown(605)).toBe('10:05')
    expect(formatCountdown(0)).toBe('0:00')
  })
})

describe('useDeadlineCountdown', () => {
  afterEach(() => vi.useRealTimers())

  it('ticks against the projected deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const { result } = renderHook(() => useDeadlineCountdown('2026-01-01T00:00:02Z'))

    expect(result.current).toBe(2)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(1)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(0)
  })
})
