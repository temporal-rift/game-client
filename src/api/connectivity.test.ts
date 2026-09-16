import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkApiConnectivity } from './connectivity'

describe('checkApiConnectivity', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('succeeds when the health endpoint responds ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))

    const result = await checkApiConnectivity('https://api.example.test')

    expect(result).toEqual({ ok: true })
  })

  it('fails with a reason when the health endpoint returns an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))

    const result = await checkApiConnectivity('https://api.example.test')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('503')
    }
  })

  it('fails with a reason when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await checkApiConnectivity('https://api.example.test')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).not.toHaveLength(0)
    }
  })
})
